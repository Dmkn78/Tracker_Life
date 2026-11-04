"""The Android outbox can retry safely, including after an edit or deletion."""
import os
import unittest
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.database import engine, get_db
from app.main import app
from app.models import Task, User
from app.security import get_current_user


@unittest.skipUnless(os.getenv("RUN_DATABASE_TESTS") == "1", "Requires rollback-only PostgreSQL checks")
class TaskCaptureApiTests(unittest.TestCase):
    def setUp(self):
        self.connection = engine.connect()
        self.transaction = self.connection.begin()
        self.db = Session(bind=self.connection, expire_on_commit=False)
        self.user = User(label="Isolated mobile capture test")
        self.db.add(self.user)
        self.db.flush()
        app.dependency_overrides[get_db] = lambda: self.db
        app.dependency_overrides[get_current_user] = lambda: self.user
        self.client = TestClient(app)
        self.payload = {"requestId": str(uuid4()), "title": "Read the report"}

    def tearDown(self):
        self.client.close()
        app.dependency_overrides.clear()
        self.db.close()
        self.transaction.rollback()
        self.connection.close()

    def test_capture_and_retry_create_one_undated_task_without_rewards(self):
        first = self.client.post("/api/tasks/capture", json=self.payload)
        self.assertEqual(first.status_code, 200, first.text)
        self.assertEqual(self.client.post("/api/tasks/capture", json=self.payload).status_code, 200)
        tasks = list(self.db.scalars(select(Task).where(Task.userId == self.user.id)))
        self.assertEqual(len(tasks), 1)
        self.assertIsNone(tasks[0].date)
        self.assertEqual(tasks[0].status, "PLANNED")
        self.assertEqual(self.client.get("/api/performance").json()["daily"]["capitalCents"], 0)

    def test_capture_can_target_a_day(self):
        response = self.client.post("/api/tasks/capture", json={**self.payload, "date": "2026-11-05"})
        self.assertEqual(response.status_code, 200, response.text)
        task = self.db.scalar(select(Task).where(Task.userId == self.user.id))
        self.assertEqual(task.date.isoformat(), "2026-11-05")

    def test_retry_preserves_edits_and_does_not_resurrect_deleted_task(self):
        first = self.client.post("/api/tasks/capture", json=self.payload).json()
        task_id = first["taskId"]
        self.client.patch("/api/tasks", json={"id": task_id, "title": "Revised title"})
        self.client.post("/api/tasks/capture", json=self.payload)
        self.assertEqual(self.db.get(Task, task_id).title, "Revised title")
        self.client.delete(f"/api/tasks?id={task_id}")
        self.db.expire_all()
        retry = self.client.post("/api/tasks/capture", json=self.payload)
        self.assertEqual(retry.status_code, 200, retry.text)
        self.assertTrue(retry.json()["deleted"])
        self.assertIsNone(self.db.scalar(select(Task).where(Task.userId == self.user.id)))

    def test_captured_task_can_be_placed_rescheduled_and_removed_from_planning(self):
        task_id = self.client.post("/api/tasks/capture", json=self.payload).json()["taskId"]
        for date, start, end in [("2026-09-17", "10:30", "12:00"), ("2026-09-18", "14:00", "15:30"), ("2026-09-19", None, None), (None, None, None)]:
            response = self.client.patch("/api/tasks", json={"id": task_id, "date": date, "startTime": start, "endTime": end})
            self.assertEqual(response.status_code, 200, response.text)
            self.db.expire_all()
            tasks = self.client.get("/api/tasks?scope=all").json()["tasks"]
            self.assertEqual(len(tasks), 1)
            self.assertEqual((tasks[0]["id"], tasks[0]["date"], tasks[0]["startTime"], tasks[0]["endTime"]), (task_id, date, start, end))
            self.assertEqual(tasks[0]["estimatedMinutes"], 0)
        self.assertEqual(self.client.get("/api/performance").json()["daily"]["capitalCents"], 0)

    def test_identifier_cannot_be_reused_by_another_user_or_for_another_title(self):
        self.client.post("/api/tasks/capture", json=self.payload)
        self.assertEqual(self.client.post("/api/tasks/capture", json={**self.payload, "title": "Different"}).status_code, 409)
        other = User(label="Other mobile test user")
        self.db.add(other); self.db.flush()
        app.dependency_overrides[get_current_user] = lambda: other
        self.assertEqual(self.client.post("/api/tasks/capture", json=self.payload).status_code, 409)

    def test_invalid_and_unauthenticated_requests_are_rejected(self):
        for changes in [{"title": "   "}, {"title": "x" * 501}, {"requestId": "bad-id"}]:
            self.assertEqual(self.client.post("/api/tasks/capture", json={**self.payload, **changes}).status_code, 422)
        app.dependency_overrides.pop(get_current_user)
        self.assertEqual(self.client.post("/api/tasks/capture", json=self.payload).status_code, 401)
