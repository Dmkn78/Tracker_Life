from datetime import date, datetime, timedelta
import unittest

from pydantic import ValidationError

from app.contracts.performance import BlockExecutionRequest, WorkSessionRequest
from app.core.completion import record_completion
from app.core.performance import OutputRecord, WorkRecord, build_performance
from app.models import Objective, Task

TODAY = date(2026, 9, 13)


class PerformanceTests(unittest.TestCase):
    def calculate(self, work=None, outputs=None, targets=None, today=TODAY, tasks=None):
        return build_performance(work or [], outputs or [], targets or {}, today, tasks or [])

    def test_empty_state_has_no_fabricated_value_or_status(self):
        result = self.calculate()
        self.assertEqual(result["index"], 0)
        self.assertEqual(result["total"]["capitalCents"], 0)
        self.assertEqual(result["status"], "Foundation")
        self.assertEqual(result["rewards"], [])

    def test_daily_total_and_focus_are_not_counted_twice(self):
        result = self.calculate([WorkRecord(TODAY, 180, "daily_log"), WorkRecord(TODAY, 90, "focus")])
        self.assertEqual(result["daily"]["minutes"], 180)
        self.assertEqual(result["daily"]["focusMinutes"], 90)
        self.assertEqual(result["daily"]["capitalCents"], 3700)

    def test_duplicate_output_has_only_one_credit(self):
        output = OutputRecord("task:1", TODAY, "Delivery", "TASK", "HIGH")
        result = self.calculate(outputs=[output, output])
        self.assertEqual(result["daily"]["tasks"], 1)
        self.assertEqual(result["daily"]["capitalCents"], 200)

    def test_objective_delivery_and_deadline_bonus(self):
        result = self.calculate(outputs=[OutputRecord("o:1", TODAY, "Ship", "PROJECT", on_time=True)])
        self.assertEqual(result["total"]["capitalCents"], 2700)
        self.assertEqual(result["total"]["productiveDays"], 1)

    def test_seven_days_create_one_dividend_and_today_has_grace(self):
        work = [WorkRecord(TODAY - timedelta(days=offset), 60, "focus") for offset in range(1, 8)]
        result = self.calculate(work)
        self.assertEqual(result["streak"], 7)
        self.assertEqual(sum(row["reason"] == "7 consecutive productive days" for row in result["rewards"]), 1)
        self.assertEqual(self.calculate(work, today=TODAY + timedelta(days=1))["streak"], 0)

    def test_gap_and_pace_use_inclusive_remaining_days(self):
        monday = TODAY - timedelta(days=6)
        result = self.calculate([WorkRecord(monday, 120, "focus")], today=monday, targets={monday: 420})
        self.assertEqual(result["expectedMinutes"], 60)
        self.assertEqual(result["gapMinutes"], 60)
        self.assertEqual(result["requiredDailyMinutes"], 43)
        sunday = self.calculate([WorkRecord(TODAY, 120, "focus")], targets={monday: 420})
        self.assertEqual(sunday["requiredDailyMinutes"], 300)

    def test_comparison_is_same_elapsed_weekdays(self):
        monday = TODAY - timedelta(days=6)
        result = self.calculate([WorkRecord(monday - timedelta(days=7), 60, "focus"), WorkRecord(monday - timedelta(days=1), 300, "focus")], today=monday)
        self.assertEqual(result["previousWeek"]["minutes"], 60)

    def test_target_changes_do_not_rewrite_previous_weeks(self):
        monday = TODAY - timedelta(days=6)
        result = self.calculate(targets={monday: 600, monday - timedelta(days=7): 1200})
        self.assertEqual(result["history"][-1]["targetMinutes"], 600)
        self.assertEqual(result["history"][-2]["targetMinutes"], 1200)

    def test_monthly_history_crosses_years_and_preserves_calendar_totals(self):
        result = self.calculate([WorkRecord(date(2025, 12, 31), 60, "focus"), WorkRecord(date(2026, 1, 1), 90, "focus")], today=date(2026, 1, 2))
        self.assertEqual(result["monthlyHistory"][-2]["start"], "2025-12-01")
        self.assertEqual(result["monthlyHistory"][-2]["minutes"], 60)
        self.assertEqual(result["monthlyHistory"][-1]["minutes"], 90)

    def test_future_work_never_earns_rewards(self):
        future = TODAY + timedelta(days=1)
        result = self.calculate([WorkRecord(future, 120, "focus")], [OutputRecord("t:1", future, "Future", "TASK")])
        self.assertEqual(result["total"]["capitalCents"], 0)

    def test_correction_revokes_focus_premium(self):
        before = self.calculate([WorkRecord(TODAY, 90, "focus")])
        after = self.calculate([WorkRecord(TODAY, 30, "focus")])
        self.assertEqual(before["daily"]["capitalCents"] - after["daily"]["capitalCents"], 1300)
        self.assertEqual(after["streak"], 0)

    def test_huge_single_day_cannot_buy_sustained_status(self):
        result = self.calculate([WorkRecord(TODAY, 100000, "focus")])
        self.assertEqual(result["total"]["minutes"], 1440)
        self.assertEqual(result["status"], "Foundation")
        self.assertLessEqual(result["index"], 100)

    def test_completion_date_and_deadline_do_not_move_on_recompletion(self):
        objective = Objective(status="DONE", targetDate=TODAY)
        record_completion(objective, "ACTIVE")
        recorded_at = objective.completedAt
        objective.targetDate = TODAY + timedelta(days=30)
        record_completion(objective, "ACTIVE")
        self.assertEqual(objective.completedAt, recorded_at)
        self.assertEqual(objective.completionDeadline, TODAY)

    def test_legacy_done_edits_do_not_fabricate_completion_date(self):
        task = Task(status="DONE", completedAt=None)
        record_completion(task, "DONE")
        self.assertIsNone(task.completedAt)

    def test_execution_validation(self):
        for payload in ({"id": "1", "executionStatus": "not_done", "actualMinutes": 90},
                        {"id": "1", "executionStatus": "done", "actualMinutes": -1}):
            with self.assertRaises(ValidationError):
                BlockExecutionRequest.model_validate(payload)
        self.assertIsNone(BlockExecutionRequest(id="1", execution_status="done").actual_minutes)

    def test_session_validation_rejects_future_or_blank_work(self):
        payload = {"requestId": "d257bb55-3e4f-4fc4-8128-a7e4ac7c507b", "date": (date.today() + timedelta(days=1)).isoformat(), "title": "Research", "actualMinutes": 30}
        with self.assertRaises(ValidationError):
            WorkSessionRequest.model_validate(payload)
        payload.update(date=date.today().isoformat(), title="   ")
        with self.assertRaises(ValidationError):
            WorkSessionRequest.model_validate(payload)
