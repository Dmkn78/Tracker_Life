"""Execution and shared performance integration, isolated by transaction rollback."""
import os
import unittest
from datetime import date, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import engine, get_db
from app.main import app
from app.models import Task, User, WeeklyPlanBlock
from app.security import get_current_user


@unittest.skipUnless(os.getenv("RUN_DATABASE_TESTS") == "1", "Requires rollback-only PostgreSQL checks")
class TaskExecutionApiTests(unittest.TestCase):
    def setUp(self):
        self.connection = engine.connect()
        self.transaction = self.connection.begin()
        self.db = Session(bind=self.connection, expire_on_commit=False)
        self.user = User(label="Task execution test")
        self.other = User(label="Other isolated user")
        self.db.add_all([self.user, self.other])
        self.db.flush()
        self.task = Task(userId=self.user.id, title="Deliver review", productive=True, estimatedMinutes=120)
        self.db.add(self.task)
        self.db.flush()
        app.dependency_overrides[get_db] = lambda: self.db
        app.dependency_overrides[get_current_user] = lambda: self.user
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        app.dependency_overrides.clear()
        self.db.close()
        self.transaction.rollback()
        self.connection.close()

    def log(self, **changes):
        payload = {"taskId": self.task.id, "date": date.today().isoformat(), "result": "partial", "actualMinutes": 30}
        payload.update(changes)
        return self.client.post("/api/tasks/execution", json=payload)

    def test_correction_persists_once_and_feeds_performance(self):
        first = self.log()
        self.assertEqual(first.status_code, 200, first.text)
        self.assertEqual(first.json()["task"]["status"], "in_progress")
        self.log(actualMinutes=45, result="done")
        retry = self.log(actualMinutes=45, result="done")
        self.assertEqual(len(retry.json()["task"]["workSessions"]), 1)
        self.assertEqual(retry.json()["task"]["completionPercent"], 100)
        daily = self.client.get("/api/performance").json()["daily"]
        self.assertEqual(daily["minutes"], 45)
        self.assertEqual(daily["capitalCents"], 1000)
        listed = self.client.get("/api/tasks?scope=all").json()["tasks"][0]
        self.assertEqual(listed["workSessions"][0]["actualMinutes"], 45)
        edited = self.client.patch("/api/tasks", json={"id": self.task.id, "title": "Updated title"})
        self.assertEqual(len(edited.json()["task"]["workSessions"]), 1)

    def test_missing_actual_time_is_never_replaced_by_estimate(self):
        response = self.log(result="done", actualMinutes=None)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertIsNone(response.json()["task"]["workSessions"][0]["actualMinutes"])
        self.assertEqual(self.client.get("/api/performance").json()["daily"]["minutes"], 0)

    def test_separate_days_and_retraction(self):
        yesterday = (date.today() - timedelta(days=1)).isoformat()
        self.log(date=yesterday)
        response = self.log()
        self.assertEqual(len(response.json()["task"]["workSessions"]), 2)
        self.log(result="not_done", actualMinutes=None)
        self.assertEqual(self.client.get("/api/performance").json()["daily"]["minutes"], 0)

    def test_foreign_cancelled_and_future_work_rejected(self):
        foreign = Task(userId=self.other.id, title="Private")
        self.db.add(foreign)
        self.db.flush()
        self.assertEqual(self.log(taskId=foreign.id).status_code, 404)
        self.assertEqual(self.log(date=(date.today() + timedelta(days=1)).isoformat()).status_code, 422)
        self.assertEqual(self.log(result="not_done").status_code, 422)
        self.task.status = "CANCELLED"
        self.db.flush()
        self.assertEqual(self.log().status_code, 400)

    def test_shared_daily_limit_and_delete_cascade(self):
        self.db.add(WeeklyPlanBlock(userId=self.user.id, title="Other work", date=date.today(), durationMinutes=0, executionStatus="done", actualMinutes=1400))
        self.db.flush()
        self.assertEqual(self.log(actualMinutes=41).status_code, 400)
        self.assertEqual(self.log(actualMinutes=40).status_code, 200)
        self.assertEqual(self.log(actualMinutes=35).status_code, 200)
        self.assertEqual(self.client.delete(f"/api/tasks?id={self.task.id}").status_code, 200)
        self.assertIsNone(self.db.scalar(select(WeeklyPlanBlock).where(WeeklyPlanBlock.taskId == self.task.id)))
