import unittest
from unittest.mock import patch

from fastapi import HTTPException
from pydantic import ValidationError

from app.contracts.tasks import TaskCreateRequest, TaskItem
from app.contracts.task_templates import TaskTemplateCreateRequest, reusable_task_fields
from app.core.task_content import has_task_content, resolve_task_title
from app.routers.tasks import create_tasks


class TaskContentTests(unittest.TestCase):
    def test_description_only_single_and_batch_requests(self):
        description = "Un long paragraphe de journée. " * 300 + "\n\nLa suite."
        for payload in [{"description": description}, {"items": [{"description": description}]}]:
            items = TaskCreateRequest.model_validate(payload).resolve_items()
            self.assertEqual(len(items), 1)
            self.assertIsNone(items[0].title)
            self.assertEqual(items[0].description, description)
            self.assertTrue(has_task_content(items[0].title, items[0].description, items[0].is_day))
        self.assertLessEqual(len(resolve_task_title(None, description, False)), 80)

    def test_day_name_is_automatic(self):
        item = TaskItem.model_validate({"isDay": True, "title": "Autre titre"})
        self.assertTrue(item.is_day)
        self.assertEqual(resolve_task_title(item.title, None, item.is_day), "Journée")
        self.assertTrue(has_task_content(None, None, True))

    def test_empty_request_is_rejected_before_any_write(self):
        self.assertFalse(has_task_content("  ", "\n ", False))
        with self.assertRaises(HTTPException) as raised:
            create_tasks(TaskCreateRequest.model_validate({}), user=None, db=None)
        self.assertEqual(raised.exception.status_code, 400)

    def test_create_router_does_not_filter_out_description_only_items(self):
        class FakeDb:
            def flush(self):
                pass

        class FakeTask:
            date = None

        body = TaskCreateRequest.model_validate({"items": [{"description": "Ma journée"}, {"title": "  "}]})
        with patch("app.routers.tasks._create_one_task", return_value=FakeTask()) as create, patch("app.routers.tasks.serialize_task", return_value={"title": "Ma journée"}), patch("app.routers.tasks.record_objective_progress"):
            response = create_tasks(body, user=type("User", (), {"id": "user-1"})(), db=FakeDb())
        self.assertEqual(create.call_count, 1)
        self.assertEqual(create.call_args.args[2].description, "Ma journée")
        self.assertEqual(len(response["tasks"]), 1)

    def test_template_retains_text_and_settings_but_resets_date_and_execution(self):
        request = TaskTemplateCreateRequest.model_validate({"name": "  Travail  ", "fields": {
            "isDay": True, "description": "Matin : coder\n\nSoir : lire", "date": "2026-10-03",
            "status": "done", "completionPercent": 100, "notDoneReason": "Ancien motif",
            "estimatedMinutes": 120, "importance": "high", "tagNames": ["Travail"],
        }})
        saved = reusable_task_fields(request.fields)
        self.assertEqual(request.name, "Travail")
        self.assertEqual(saved["description"], request.fields.description)
        self.assertTrue(saved["isDay"])
        self.assertIsNone(saved["date"])
        self.assertEqual(saved["status"], "planned")
        self.assertEqual(saved["completionPercent"], 0)
        self.assertIsNone(saved["notDoneReason"])
        self.assertEqual(saved["importance"], "high")
        self.assertEqual(saved["estimatedMinutes"], 120)
        self.assertEqual(saved["tagNames"], ["Travail"])

    def test_template_requires_a_nonblank_name(self):
        with self.assertRaises(ValidationError):
            TaskTemplateCreateRequest.model_validate({"name": "   ", "fields": {"isDay": True}})
