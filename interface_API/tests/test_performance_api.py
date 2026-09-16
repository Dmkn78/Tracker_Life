"""Opt-in PostgreSQL checks. Every test runs inside a rolled-back transaction."""

import os
import unittest
from datetime import date, timedelta
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.database import engine, get_db
from app.main import app
from app.models import DailyLog, Task, User, WeeklyPlanBlock
from app.security import get_current_user


@unittest.skipUnless(os.getenv("RUN_DATABASE_TESTS") == "1", "Set RUN_DATABASE_TESTS=1 to run rollback-only PostgreSQL checks")
class PerformanceApiTests(unittest.TestCase):
    def setUp(self):
        self.connection = engine.connect()
        self.transaction = self.connection.begin()
        self.db = Session(bind=self.connection, expire_on_commit=False)
        self.user = User(label="Performance integration test")
        self.other = User(label="Other isolated test user")
        self.db.add_all([self.user, self.other]); self.db.flush()
        app.dependency_overrides[get_db] = lambda: self.db
        app.dependency_overrides[get_current_user] = lambda: self.user
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        app.dependency_overrides.clear()
        self.db.close()
        self.transaction.rollback()
        self.connection.close()

    def work(self, **changes):
        payload = {"requestId": str(uuid4()), "title": "Research", "date": date.today().isoformat(), "actualMinutes": 90}
        payload.update(changes)
        response = self.client.post("/api/performance/work", json=payload)
        return response, payload

    def test_session_is_persisted_and_retry_is_idempotent(self):
        response, payload = self.work()
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["daily"]["capitalCents"], 1900)
        retry = self.client.post("/api/performance/work", json=payload)
        self.assertEqual(retry.json()["daily"]["minutes"], 90)
        self.db.expire_all()
        self.assertEqual(self.client.get("/api/performance").json()["daily"]["minutes"], 90)
        payload["actualMinutes"] = 120
        self.assertEqual(self.client.post("/api/performance/work", json=payload).status_code, 409)

    def test_correction_removes_credit(self):
        _, payload = self.work()
        response = self.client.patch("/api/performance/block", json={"id": payload["requestId"], "executionStatus": "not_done"})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["daily"]["capitalCents"], 0)

    def test_ownership_and_authentication(self):
        block = WeeklyPlanBlock(userId=self.other.id, title="Private", date=date.today(), durationMinutes=60)
        self.db.add(block); self.db.flush()
        response = self.client.patch("/api/performance/block", json={"id": block.id, "executionStatus": "done", "actualMinutes": 60})
        self.assertEqual(response.status_code, 404)
        app.dependency_overrides.pop(get_current_user)
        self.assertEqual(self.client.get("/api/performance").status_code, 401)
        self.assertEqual(self.client.post("/api/performance/work", json={}).status_code, 401)

    def test_target_is_persisted(self):
        response = self.client.patch("/api/performance/target", json={"targetMinutes": 1800})
        self.assertEqual(response.status_code, 200, response.text)
        self.db.expire_all()
        self.assertEqual(self.client.get("/api/performance").json()["targetMinutes"], 1800)

    def test_submitted_daily_totals_do_not_duplicate_sessions(self):
        self.db.add(DailyLog(userId=self.user.id, date=date.today(), status="SUBMITTED", workTimeMinutes=120))
        self.db.flush()
        response, _ = self.work()
        self.assertEqual(response.json()["daily"]["minutes"], 120)

    def test_planning_earns_no_value_and_logging_without_minutes_does_not_invent_time(self):
        block = WeeklyPlanBlock(userId=self.user.id, title="Plan", date=date.today(), durationMinutes=120)
        self.db.add(block); self.db.flush()
        response = self.client.patch("/api/performance/block", json={"id": block.id, "executionStatus": "done"})
        self.assertEqual(response.json()["daily"]["capitalCents"], 0)

    def test_task_completion_and_recompletion_share_one_record(self):
        task = Task(userId=self.user.id, title="Output", status="PLANNED", productive=True)
        self.db.add(task); self.db.flush()
        response = self.client.patch("/api/tasks", json={"id": task.id, "status": "done", "completionPercent": 100})
        self.assertEqual(response.status_code, 200, response.text)
        first_completion = task.completedAt
        self.assertEqual(self.client.get("/api/performance").json()["daily"]["tasks"], 1)
        self.client.patch("/api/tasks", json={"id": task.id, "status": "planned"})
        self.assertEqual(self.client.get("/api/performance").json()["daily"]["tasks"], 0)
        self.client.patch("/api/tasks", json={"id": task.id, "status": "done"})
        self.assertEqual(task.completedAt, first_completion)
        self.assertEqual(self.client.get("/api/performance").json()["daily"]["tasks"], 1)

    def test_cannot_overfill_a_day_or_move_logged_work_to_future(self):
        response, payload = self.work(actualMinutes=1400)
        self.assertEqual(response.status_code, 200)
        response, _ = self.work(actualMinutes=41)
        self.assertEqual(response.status_code, 400)
        response = self.client.patch("/api/objectives", json={"id": payload["requestId"], "kind": "weekly_block", "date": (date.today() + timedelta(days=1)).isoformat()})
        self.assertEqual(response.status_code, 400)

    def test_objective_delivery_flows_into_the_rewards_ledger(self):
        response = self.client.post("/api/objectives", json={"title": "Deliver project", "kind": "project", "status": "active", "targetDate": date.today().isoformat()})
        self.assertEqual(response.status_code, 200, response.text)
        objective_id = response.json()["objective"]["id"]
        response = self.client.patch("/api/objectives", json={"id": objective_id, "status": "done"})
        self.assertEqual(response.status_code, 200, response.text)
        performance = self.client.get("/api/performance").json()
        self.assertEqual(performance["daily"]["objectives"], 1)
        self.assertEqual(performance["daily"]["capitalCents"], 2700)
        self.assertIn("on time", performance["rewards"][0]["reason"])
