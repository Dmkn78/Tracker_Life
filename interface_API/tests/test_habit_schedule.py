import unittest
from datetime import date

from pydantic import ValidationError

from app.contracts.habits import HabitCreateRequest, HabitUpdateRequest
from app.core.habit_schedule import (
    end_time_for_duration,
    is_scheduled_on,
    normalize_recurrence_days,
    routine_occurrence_bounds,
)


class HabitScheduleTests(unittest.TestCase):
    def test_iso_weekday_presets_and_normalization(self):
        self.assertEqual(normalize_recurrence_days([5, 1, 2, 2, 4, 3]), [1, 2, 3, 4, 5])
        self.assertTrue(is_scheduled_on(date(2026, 8, 10), [1, 2, 3, 4, 5]))
        self.assertFalse(is_scheduled_on(date(2026, 8, 9), [1, 2, 3, 4, 5]))
        self.assertTrue(is_scheduled_on(date(2026, 8, 9), [7]))

    def test_time_block_duration_and_midnight(self):
        self.assertEqual(end_time_for_duration("23:30", 90), "01:00")
        start, end = routine_occurrence_bounds(date(2026, 8, 9), "23:30", "01:00")
        self.assertEqual((end - start).total_seconds(), 90 * 60)

    def test_contract_normalizes_days_and_requires_a_valid_time_block(self):
        request = HabitCreateRequest.model_validate({
            "name": "Move",
            "recurrenceDays": [5, 1, 2, 2, 4, 3],
            "targetTime": "07:30",
            "defaultExpectedMinutes": 30,
            "timeBlockEnabled": True,
        })
        self.assertEqual(request.recurrence_days, [1, 2, 3, 4, 5])
        with self.assertRaises(ValidationError):
            HabitCreateRequest.model_validate({"name": "Broken", "recurrenceDays": [0, 8]})
        with self.assertRaises(ValidationError):
            HabitCreateRequest.model_validate({"name": "Broken", "targetTime": "25:00"})
        with self.assertRaises(ValidationError):
            HabitCreateRequest.model_validate({"name": "Broken", "timeBlockEnabled": True})

    def test_checkin_status_is_closed(self):
        with self.assertRaises(ValidationError):
            HabitUpdateRequest.model_validate({
                "kind": "checkin", "habitId": "habit-1", "status": "unknown"
            })


if __name__ == "__main__":
    unittest.main()
