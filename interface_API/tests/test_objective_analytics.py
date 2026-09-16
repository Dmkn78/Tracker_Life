import unittest
from datetime import date, timedelta

from app.core.objective_analytics import Checkpoint, NetworkTask, critical_path, expected_progress, trajectory
from app.core.objective_progress import rollup_progress
from app.models import Objective, ObjectivePlan, Task


class ObjectiveAnalyticsTests(unittest.TestCase):
    def test_nested_progress_includes_undated_tasks_and_done_status(self):
        objectives = [Objective(id="parent", status="ACTIVE"), Objective(id="child", parentId="parent", status="ACTIVE")]
        tasks = [Task(id="one", objectiveId="child", status="DONE", completionPercent=0), Task(id="two", objectiveId="child", status="PLANNED", completionPercent=0)]
        self.assertEqual(rollup_progress(objectives, tasks, {}), {"child": 50, "parent": 50})
        plans = {"child": ObjectivePlan(manualProgress=80)}
        self.assertEqual(rollup_progress(objectives, tasks, plans)["parent"], 80)

    def test_expected_progress_is_bounded(self):
        start = date(2026, 9, 1)
        deadline = date(2026, 9, 11)
        self.assertEqual(expected_progress(start, deadline, date(2026, 9, 6)), 50)
        self.assertEqual(expected_progress(start, deadline, date(2026, 8, 31)), 0)
        self.assertEqual(expected_progress(start, deadline, date(2026, 9, 20)), 100)
        self.assertIsNone(expected_progress(start, None, deadline))

    def test_forecast_and_momentum_use_observations(self):
        today = date(2026, 9, 15)
        history = [Checkpoint(today - timedelta(days=14), 10), Checkpoint(today - timedelta(days=7), 20)]
        result = trajectory(40, history, today + timedelta(days=14), today)
        self.assertEqual(result["velocity"], 20)
        self.assertEqual(result["momentum"], 10)
        self.assertEqual(result["forecastDate"], "2026-10-06")
        self.assertEqual(result["slipDays"], 7)
        self.assertEqual(result["requiredVelocity"], 30)
        self.assertIsNone(result["onTimeProbability"])

    def test_stalled_and_missing_history_do_not_fabricate_finish_dates(self):
        today = date(2026, 9, 15)
        self.assertIsNone(trajectory(40, [], today + timedelta(days=7), today)["forecastDate"])
        self.assertIsNone(trajectory(40, [Checkpoint(today - timedelta(days=7), 40)], today + timedelta(days=7), today)["forecastDate"])

    def test_monte_carlo_is_deterministic_and_requires_daily_history(self):
        today = date(2026, 9, 15)
        history = [Checkpoint(today - timedelta(days=7 - index), index * 10) for index in range(7)]
        result = trajectory(70, history, today + timedelta(days=4), today)
        self.assertEqual(result["onTimeProbability"], 100)
        self.assertEqual(result, trajectory(70, history, today + timedelta(days=4), today))
        self.assertIsNone(trajectory(70, history[:3], today + timedelta(days=4), today)["onTimeProbability"])

    def test_critical_path_accounts_for_parallel_work_and_slack(self):
        tasks = [NetworkTask("a", "Research", 0, 60, 60, 60, ()), NetworkTask("b", "Build", 0, 120, 120, 120, ("a",)), NetworkTask("c", "Notes", 0, 30, 30, 30, ("a",)), NetworkTask("d", "Ship", 0, 60, 60, 60, ("b", "c"))]
        result = critical_path(tasks)
        self.assertEqual(result["totalMinutes"], 240)
        self.assertEqual([task["id"] for task in result["tasks"] if task["critical"]], ["a", "b", "d"])
        self.assertEqual(next(task for task in result["tasks"] if task["id"] == "c")["slackMinutes"], 90)

    def test_cycles_rejected_and_missing_estimates_remain_unknown(self):
        with self.assertRaises(ValueError):
            critical_path([NetworkTask("a", "A", 0, 1, 1, 1, ("b",)), NetworkTask("b", "B", 0, 1, 1, 1, ("a",))])
        result = critical_path([NetworkTask("a", "A", 0, 0, 0, 0, ())])
        self.assertEqual(result["missingEstimates"], 1)
        self.assertFalse(result["tasks"][0]["critical"])
