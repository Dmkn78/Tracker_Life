"""Integration checks use rollback-only test data in the local PostgreSQL database."""

import os
import unittest
from datetime import date, timedelta
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import engine, get_db
from app.main import app
from app.models import Objective, ObjectivePlan, ObjectiveProgressEntry, Task, User, WeeklyPlanBlock
from app.security import get_current_user


@unittest.skipUnless(os.getenv("RUN_DATABASE_TESTS") == "1", "Set RUN_DATABASE_TESTS=1 for rollback-only database checks")
class ObjectivePlanningApiTests(unittest.TestCase):
    def setUp(self):
        self.connection = engine.connect()
        self.transaction = self.connection.begin()
        self.db = Session(bind=self.connection, expire_on_commit=False)
        self.user = User(label="Isolated planning test")
        self.other = User(label="Other isolated planning test")
        self.db.add_all([self.user, self.other]); self.db.flush()
        self.objective = Objective(userId=self.user.id, title="Research", horizon="MONTH", status="ACTIVE", targetDate=date.today() + timedelta(days=14))
        self.private = Objective(userId=self.other.id, title="Private", horizon="MONTH")
        self.db.add_all([self.objective, self.private]); self.db.flush()
        app.dependency_overrides[get_db] = lambda: self.db
        app.dependency_overrides[get_current_user] = lambda: self.user
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close(); app.dependency_overrides.clear()
        self.db.close(); self.transaction.rollback(); self.connection.close()

    def get_data(self):
        response = self.client.get("/api/objectives/planning")
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_read_model_is_private_and_has_no_invented_forecast(self):
        response = self.get_data()
        self.assertEqual(len(response["insights"]), 1)
        self.assertIsNone(response["insights"][0]["forecastDate"])
        self.assertIsNone(response["insights"][0]["onTimeProbability"])
        self.assertIn(len(response["weeks"]), (4, 5, 6))
        self.assertEqual(self.client.get("/api/objectives/planning?month=not-a-month").status_code, 400)
        app.dependency_overrides.pop(get_current_user)
        self.assertEqual(self.client.get("/api/objectives/planning").status_code, 401)

    def test_settings_checkpoint_and_accept_forecast(self):
        start = date.today() - timedelta(days=14)
        response = self.client.patch("/api/objectives/planning/settings", json={"objectiveId": self.objective.id, "startDate": start.isoformat(), "effortMinutes": 1200, "impact": 80, "manualProgress": 50})
        self.assertEqual(response.status_code, 200, response.text)
        response = self.client.post("/api/objectives/planning/checkpoint", json={"objectiveId": self.objective.id, "date": start.isoformat(), "progress": 0})
        self.assertEqual(response.status_code, 200, response.text)
        insight = self.get_data()["insights"][0]
        self.assertEqual(insight["velocity"], 25)
        self.assertEqual(insight["forecastDate"], (date.today() + timedelta(days=14)).isoformat())
        response = self.client.post("/api/objectives/planning/decision", json={"objectiveId": self.objective.id, "action": "accept_forecast", "forecastDate": insight["forecastDate"]})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.client.post("/api/objectives/planning/decision", json={"objectiveId": self.objective.id, "action": "accept_forecast", "forecastDate": date.today().isoformat()}).status_code, 409)

    def test_undated_task_completion_updates_hierarchy_and_daily_history(self):
        child = Objective(userId=self.user.id, parentId=self.objective.id, title="Milestone", horizon="WEEK")
        self.db.add(child); self.db.flush()
        response = self.client.post("/api/tasks", json={"objectiveId": child.id, "title": "Undated deliverable", "estimatedMinutes": 60})
        self.assertEqual(response.status_code, 200, response.text)
        task_id = response.json()["task"]["id"]
        response = self.client.patch("/api/tasks", json={"id": task_id, "status": "done"})
        self.assertEqual(response.status_code, 200, response.text)
        response = self.client.get("/api/objectives?week_id=2027-W01")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["tree"][0]["completionPercent"], 100)
        history = self.db.get(ObjectiveProgressEntry, (self.objective.id, date.today()))
        self.assertEqual(history.progress, 100)

    def test_dependencies_validate_ownership_estimates_and_cycles(self):
        tasks = [Task(userId=self.user.id, objectiveId=self.objective.id, title=title) for title in ("Research", "Build")]
        self.db.add_all(tasks); self.db.flush()
        def plan(task_id, parents):
            return self.client.patch("/api/objectives/planning/task", json={"taskId": task_id, "optimisticMinutes": 30, "likelyMinutes": 60, "pessimisticMinutes": 90, "predecessorIds": parents})
        self.assertEqual(plan(tasks[1].id, [tasks[0].id]).status_code, 200)
        self.assertEqual(plan(tasks[0].id, [tasks[1].id]).status_code, 400)
        self.assertEqual(plan(tasks[0].id, [self.private.id]).status_code, 400)
        self.assertEqual(plan("missing", []).status_code, 404)
        self.assertEqual(len(self.get_data()["insights"][0]["network"]["tasks"]), 2)

    def test_replanning_is_idempotent_and_preserves_logged_work(self):
        block = WeeklyPlanBlock(userId=self.user.id, objectiveId=self.objective.id, title="Focus", date=date.today(), durationMinutes=120, executionStatus="partial", actualMinutes=30)
        self.db.add(block); self.db.flush()
        payload = {"blockId": block.id, "action": "replan", "date": (date.today() + timedelta(days=1)).isoformat(), "durationMinutes": 45}
        first = self.client.post("/api/objectives/planning/recovery", json=payload)
        self.assertEqual(first.status_code, 200, first.text)
        second = self.client.post("/api/objectives/planning/recovery", json=payload)
        self.assertEqual(first.json(), second.json())
        self.assertEqual(block.actualMinutes, 30)
        replacement = self.db.get(WeeklyPlanBlock, first.json()["replacementId"])
        self.assertIsNone(replacement.actualMinutes)
        self.assertEqual(replacement.executionStatus, "planned")

    def test_ignore_reallocate_and_reduce_scope_persist(self):
        self.db.add(ObjectivePlan(objectiveId=self.objective.id, startDate=date.today(), effortMinutes=1200))
        block = WeeklyPlanBlock(userId=self.user.id, title="Available", date=date.today(), durationMinutes=60)
        self.db.add(block); self.db.flush()
        for action, fields in (("ignore", {}), ("reduce_scope", {"effortMinutes": 600})):
            response = self.client.post("/api/objectives/planning/decision", json={"objectiveId": self.objective.id, "action": action, **fields})
            self.assertEqual(response.status_code, 200, response.text)
        response = self.client.post("/api/objectives/planning/reallocate", json={"objectiveId": self.objective.id, "blockId": block.id})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(block.objectiveId, self.objective.id)
        insight = self.get_data()["insights"][0]
        self.assertEqual(insight["effortMinutes"], 600)
        self.assertIsNotNone(insight["ignoredUntil"])
        self.assertEqual(self.get_data()["recommendations"], [])

    def test_future_checkpoints_and_foreign_objective_writes_are_rejected(self):
        response = self.client.post("/api/objectives/planning/checkpoint", json={"objectiveId": self.objective.id, "date": (date.today() + timedelta(days=1)).isoformat(), "progress": 70})
        self.assertEqual(response.status_code, 422)
        response = self.client.patch("/api/objectives/planning/settings", json={"objectiveId": self.private.id, "startDate": date.today().isoformat(), "effortMinutes": 60, "impact": 50})
        self.assertEqual(response.status_code, 404)

    def test_recovery_schedule_is_reviewable_idempotent_and_earns_no_credit(self):
        payload = {"requestId": str(uuid4()), "objectiveId": self.objective.id, "startDate": date.today().isoformat(), "days": 3, "dailyMinutes": 30}
        first = self.client.post("/api/objectives/planning/recovery-schedule", json=payload)
        self.assertEqual(first.status_code, 200, first.text)
        self.assertEqual(self.client.post("/api/objectives/planning/recovery-schedule", json=payload).status_code, 200)
        blocks = list(self.db.scalars(select(WeeklyPlanBlock).where(WeeklyPlanBlock.userId == self.user.id)))
        self.assertEqual(len(blocks), 3)
        self.assertTrue(all(block.actualMinutes is None and block.executionStatus == "planned" for block in blocks))
        payload["dailyMinutes"] = 45
        self.assertEqual(self.client.post("/api/objectives/planning/recovery-schedule", json=payload).status_code, 409)
        self.assertEqual(self.client.get("/api/performance").json()["daily"]["capitalCents"], 0)
