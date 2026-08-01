from __future__ import annotations

import unittest

from pydantic import ValidationError

from app.contracts.calendar_events import CalendarEventCreateRequest
from app.contracts.daily_log import DailyLogUpsertRequest
from app.contracts.habits import HabitUpdateRequest
from app.contracts.objectives import ObjectiveCreateRequest
from app.contracts.settings import SettingsUpdateRequest
from app.contracts.time_allocation import TimeAllocationUpdateRequest
from app.core.dates import to_utc_naive


class RequestContractTests(unittest.TestCase):
    def test_daily_log_normalizes_camel_case_and_enum_case(self) -> None:
        request = DailyLogUpsertRequest.model_validate(
            {
                "date": "2026-07-31",
                "status": "submitted",
                "startFriction": 42,
                "mainBlockerOtherText": "ignored presentation field",
            }
        )

        self.assertEqual(request.date.isoformat(), "2026-07-31")
        self.assertEqual(request.status.value, "SUBMITTED")
        self.assertEqual(request.start_friction, 42)

    def test_daily_log_rejects_out_of_range_score(self) -> None:
        with self.assertRaises(ValidationError):
            DailyLogUpsertRequest.model_validate({"energy": 101})

    def test_sleep_intent_offset_normalizes_to_utc(self) -> None:
        request = DailyLogUpsertRequest.model_validate(
            {"sleepIntentClickedAt": "2026-07-31T23:30:00+02:00"}
        )

        self.assertEqual(
            to_utc_naive(request.sleep_intent_clicked_at).isoformat(),
            "2026-07-31T21:30:00",
        )

    def test_calendar_rejects_reverse_time_range(self) -> None:
        with self.assertRaises(ValidationError):
            CalendarEventCreateRequest.model_validate(
                {
                    "start": "2026-07-31T12:00:00Z",
                    "end": "2026-07-31T11:00:00Z",
                }
            )

    def test_calendar_compares_mixed_timezone_inputs(self) -> None:
        request = CalendarEventCreateRequest.model_validate(
            {
                "start": "2026-07-31T12:00:00+02:00",
                "end": "2026-07-31T10:30:00",
            }
        )

        self.assertEqual(to_utc_naive(request.start).isoformat(), "2026-07-31T10:00:00")

    def test_partial_objective_update_does_not_default_kind(self) -> None:
        from app.contracts.objectives import ObjectiveUpdateRequest

        request = ObjectiveUpdateRequest.model_validate({"id": "objective-1", "title": "Renamed"})

        self.assertIsNone(request.kind)

    def test_habit_checkin_requires_habit_id(self) -> None:
        with self.assertRaises(ValidationError):
            HabitUpdateRequest.model_validate({"kind": "checkin"})

    def test_allocation_update_requires_category_id(self) -> None:
        with self.assertRaises(ValidationError):
            TimeAllocationUpdateRequest.model_validate({"kind": "allocation"})

    def test_portfolio_update_requires_name(self) -> None:
        with self.assertRaises(ValidationError):
            TimeAllocationUpdateRequest.model_validate({"kind": "portfolio", "name": " "})

    def test_weekly_block_requires_date(self) -> None:
        with self.assertRaises(ValidationError):
            ObjectiveCreateRequest.model_validate({"kind": "weekly_block"})

    def test_settings_coerces_numeric_form_values(self) -> None:
        request = SettingsUpdateRequest.model_validate(
            {"calorieTarget": "2400", "defaultSleepDelayMin": 25}
        )

        self.assertEqual(request.calorie_target, 2400)
        self.assertEqual(request.default_sleep_delay_min, 25)


if __name__ == "__main__":
    unittest.main()
