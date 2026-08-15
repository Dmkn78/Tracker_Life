from __future__ import annotations

import unittest
from datetime import datetime

from pydantic import ValidationError

from app.contracts.calendar_events import CalendarEventCreateRequest
from app.contracts.daily_log import DailyLogUpsertRequest
from app.contracts.emotional_reviews import EmotionalReviewUpsertRequest, validate_iso_week_id
from app.contracts.habits import HabitUpdateRequest
from app.contracts.objectives import ObjectiveCreateRequest
from app.contracts.settings import SettingsUpdateRequest
from app.contracts.tasks import TaskItem, TaskUpdateRequest
from app.contracts.time_allocation import TimeAllocationUpdateRequest
from app.core.dates import to_utc_naive
from app.models import Task
from app.routers.tasks import serialize_task
from app.routers.calendar_events import list_events, resolve_event_range


class RequestContractTests(unittest.TestCase):
    def test_emotional_review_accepts_valid_week_and_intensities(self) -> None:
        request = EmotionalReviewUpsertRequest.model_validate({
            "weekId": "2026-W33",
            "emotions": [{"name": "calm", "intensity": 4}],
            "stressLevel": 35,
        })
        self.assertEqual(request.week_id, "2026-W33")
        self.assertEqual(request.emotions[0].intensity, 4)

    def test_emotional_review_rejects_invalid_week_and_ranges(self) -> None:
        with self.assertRaises(ValueError):
            validate_iso_week_id("2026-W54")
        with self.assertRaises(ValidationError):
            EmotionalReviewUpsertRequest.model_validate({"weekId": "2026-W33", "stressLevel": 101})
        with self.assertRaises(ValidationError):
            EmotionalReviewUpsertRequest.model_validate({"weekId": "2026-W33", "emotions": [{"name": "stress", "intensity": 6}]})

    def test_calendar_instant_range_requires_a_complete_ordered_pair(self) -> None:
        with self.assertRaises(Exception):
            resolve_event_range(None, None, datetime.fromisoformat("2026-08-01T00:00:00Z"), None)
        with self.assertRaises(Exception):
            resolve_event_range(
                None,
                None,
                datetime.fromisoformat("2026-08-02T00:00:00Z"),
                datetime.fromisoformat("2026-08-01T00:00:00Z"),
            )

    def test_calendar_civil_fallback_is_half_open_through_next_midnight(self) -> None:
        start, end = resolve_event_range("2026-08-01", "2026-08-03", None, None)
        self.assertEqual(start, datetime.fromisoformat("2026-08-01T00:00:00"))
        self.assertEqual(end, datetime.fromisoformat("2026-08-04T00:00:00"))

    def test_calendar_range_query_uses_overlap_and_preserves_dst_offsets(self) -> None:
        class EmptyResult:
            def scalars(self):
                return []

        class CapturingDb:
            statement = None

            def execute(self, statement):
                self.statement = statement
                return EmptyResult()

        db = CapturingDb()
        list_events(
            from_=None,
            to=None,
            event_start=datetime.fromisoformat("2026-10-25T00:00:00+02:00"),
            event_end_exclusive=datetime.fromisoformat("2026-10-25T04:00:00+01:00"),
            user=type("User", (), {"id": "user-1"})(),
            db=db,
        )

        compiled = db.statement.compile()
        query_text = str(compiled)
        self.assertIn('"CalendarEvent"."end" >', query_text)
        self.assertIn('"CalendarEvent".start <', query_text)
        self.assertIn(datetime.fromisoformat("2026-10-24T22:00:00"), compiled.params.values())
        self.assertIn(datetime.fromisoformat("2026-10-25T03:00:00"), compiled.params.values())

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

    def test_month_allocation_accepts_realistic_period_cap(self) -> None:
        request = TimeAllocationUpdateRequest.model_validate({
            "kind": "allocation",
            "period": "month",
            "date": "2026-08-01",
            "categoryId": "category-1",
            "plannedMinutes": 20_000,
        })
        self.assertEqual(request.planned_minutes, 20_000)

    def test_period_actual_cannot_be_written(self) -> None:
        with self.assertRaises(ValidationError):
            TimeAllocationUpdateRequest.model_validate({
                "kind": "allocation",
                "period": "week",
                "categoryId": "category-1",
                "actualMinutes": 60,
            })

    def test_february_budget_uses_the_civil_month_cap(self) -> None:
        with self.assertRaises(ValidationError):
            TimeAllocationUpdateRequest.model_validate({
                "kind": "period_budget",
                "period": "month",
                "date": "2026-02-01",
                "periodBudgetMinutes": 42_000,
            })

    def test_leap_february_accepts_its_exact_civil_month_cap(self) -> None:
        request = TimeAllocationUpdateRequest.model_validate({
            "kind": "period_budget",
            "period": "month",
            "date": "2028-02-01",
            "periodBudgetMinutes": 29 * 1_440,
        })
        self.assertEqual(request.period_budget_minutes, 29 * 1_440)

    def test_period_update_requires_an_explicit_date(self) -> None:
        with self.assertRaises(ValidationError):
            TimeAllocationUpdateRequest.model_validate({
                "kind": "period_budget",
                "period": "week",
                "periodBudgetMinutes": 5_040,
            })

    def test_weekly_block_requires_date(self) -> None:
        with self.assertRaises(ValidationError):
            ObjectiveCreateRequest.model_validate({"kind": "weekly_block"})

    def test_settings_coerces_numeric_form_values(self) -> None:
        request = SettingsUpdateRequest.model_validate(
            {"calorieTarget": "2400", "defaultSleepDelayMin": 25}
        )

        self.assertEqual(request.calorie_target, 2400)
        self.assertEqual(request.default_sleep_delay_min, 25)

    def test_task_importance_accepts_medium_high_round_trip(self) -> None:
        medium_update = TaskUpdateRequest.model_validate(
            {"id": "task-1", "importance": "medium"}
        )
        high_update = TaskUpdateRequest.model_validate(
            {"id": "task-1", "importance": "high"}
        )

        self.assertEqual(medium_update.importance.value, "MEDIUM")
        self.assertEqual(high_update.importance.value, "HIGH")

    def test_task_contract_accepts_not_done_reason(self) -> None:
        task = TaskItem.model_validate(
            {
                "title": "Prepare review",
                "status": "not_done",
                "notDoneReason": "External dependency",
            }
        )

        self.assertEqual(task.status.value, "NOT_DONE")
        self.assertEqual(task.not_done_reason, "External dependency")

    def test_task_serializer_preserves_importance_and_not_done_reason(self) -> None:
        task = Task(
            id="task-1",
            userId="user-1",
            title="Prepare review",
            importance="HIGH",
            productive=True,
            estimatedMinutes=30,
            completionPercent=50,
            status="NOT_DONE",
            notDoneReason="External dependency",
            sortOrder=10,
            createdAt=datetime(2026, 8, 9, 10, 0),
            updatedAt=datetime(2026, 8, 9, 10, 0),
        )

        serialized = serialize_task(
            object(),
            task,
            objective_title="",
            tags=[],
        )

        self.assertEqual(serialized["importance"], "high")
        self.assertEqual(serialized["status"], "not_done")
        self.assertEqual(serialized["notDoneReason"], "External dependency")


if __name__ == "__main__":
    unittest.main()
