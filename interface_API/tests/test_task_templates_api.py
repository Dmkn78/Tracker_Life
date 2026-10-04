"""Task content and personal templates, with rollback-only PostgreSQL checks."""
import os
import unittest

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import engine, get_db
from app.main import app
from app.models import Task, TaskTemplate, User
from app.security import get_current_user


@unittest.skipUnless(os.getenv("RUN_DATABASE_TESTS") == "1", "Requires rollback-only PostgreSQL checks")
class TaskTemplatesApiTests(unittest.TestCase):
    def setUp(self):
        self.connection = engine.connect()
        self.transaction = self.connection.begin()
        self.db = Session(bind=self.connection, expire_on_commit=False)
        self.user = User(label="Isolated task template test")
        self.other = User(label="Other isolated template user")
        self.db.add_all([self.user, self.other])
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

    def test_long_description_only_create_and_edit_are_saved(self):
        description = "Mon paragraphe de journée. " * 300 + "\n\nUne seconde partie."
        created = self.client.post("/api/tasks", json={"description": description, "date": "2026-10-03"})
        self.assertEqual(created.status_code, 200, created.text)
        task = created.json()["task"]
        self.assertEqual(task["description"], description)
        self.assertLessEqual(len(task["title"]), 80)
        edited = self.client.patch("/api/tasks", json={"id": task["id"], "title": "", "description": "Nouveau paragraphe\n\nSuite"})
        self.assertEqual(edited.status_code, 200, edited.text)
        self.db.expire_all()
        saved = self.db.get(Task, task["id"])
        self.assertEqual(saved.description, "Nouveau paragraphe\n\nSuite")
        self.assertEqual(saved.title, "Nouveau paragraphe Suite")
        self.assertFalse(saved.isDay)

    def test_day_flag_and_templates_persist_without_creating_a_task_on_save(self):
        fields = {"isDay": True, "description": "Matin : travailler\n\nSoir : lire", "date": "2026-10-03", "completionPercent": 100, "status": "done"}
        created = self.client.post("/api/task-templates", json={"name": "Ma journée", "fields": fields})
        self.assertEqual(created.status_code, 200, created.text)
        template = created.json()["template"]
        self.assertIsNone(self.db.scalar(select(Task).where(Task.userId == self.user.id)))
        self.db.expire_all()
        listed = self.client.get("/api/task-templates").json()["templates"]
        self.assertEqual(listed, [template])
        self.assertIsNone(template["fields"]["date"])
        self.assertEqual(template["fields"]["completionPercent"], 0)
        self.assertEqual(template["fields"]["status"], "planned")
        reused = self.client.post("/api/tasks", json={**template["fields"], "date": "2026-10-04"})
        self.assertEqual(reused.status_code, 200, reused.text)
        task = reused.json()["task"]
        self.assertEqual(task["title"], "Journée")
        self.assertTrue(task["isDay"])
        self.assertEqual(task["date"], "2026-10-04")
        self.assertEqual(task["description"], fields["description"])
        self.db.expire_all()
        self.assertTrue(self.db.get(Task, task["id"]).isDay)
        renamed = self.client.patch("/api/tasks", json={"id": task["id"], "isDay": False, "title": "Mon projet"})
        self.assertEqual(renamed.status_code, 200, renamed.text)
        self.assertFalse(renamed.json()["task"]["isDay"])
        self.assertEqual(renamed.json()["task"]["title"], "Mon projet")

    def test_templates_are_private_and_can_be_deleted_by_their_owner(self):
        response = self.client.post("/api/task-templates", json={"name": "Personnel", "fields": {"isDay": True}})
        self.assertEqual(response.status_code, 200, response.text)
        template_id = response.json()["template"]["id"]
        app.dependency_overrides[get_current_user] = lambda: self.other
        self.assertEqual(self.client.get("/api/task-templates").json()["templates"], [])
        self.assertEqual(self.client.delete(f"/api/task-templates?id={template_id}").status_code, 404)
        app.dependency_overrides[get_current_user] = lambda: self.user
        self.assertEqual(self.client.delete(f"/api/task-templates?id={template_id}").status_code, 200)
        self.db.flush()
        self.assertIsNone(self.db.get(TaskTemplate, template_id))

    def test_templates_require_authentication_and_content(self):
        empty = self.client.post("/api/task-templates", json={"name": "Vide", "fields": {}})
        self.assertEqual(empty.status_code, 400, empty.text)
        app.dependency_overrides.pop(get_current_user)
        self.assertEqual(self.client.get("/api/task-templates").status_code, 401)
