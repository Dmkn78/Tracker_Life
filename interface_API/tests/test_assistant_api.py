"""Local assistant previews remain private, validated, and read-only."""

from datetime import date
import json
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
from sqlalchemy import JSON, MetaData, create_engine, func, select
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.ai.adapters import openai_adapter
from app.core.ai.errors import AiProviderError
from app.database import get_db
from app.main import app
from app.models import AiProvider, DailyLog, Task, User
from app.security import get_current_user


SELECTED_DATE = "2026-10-01"
GENERATED_TASK = {
    "title": "Préparer le rapport",
    "description": "Relire les notes avant la réunion.",
    "date": SELECTED_DATE,
    "startTime": "10:00",
    "endTime": "11:00",
    "estimatedMinutes": 60,
    "importance": "high",
    "productive": True,
}


class AssistantApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
        )
        metadata = MetaData()
        User.__table__.to_metadata(metadata)
        Task.__table__.to_metadata(metadata)
        AiProvider.__table__.to_metadata(metadata)
        self.logs_table = DailyLog.__table__.to_metadata(metadata)
        for column in self.logs_table.columns:
            if isinstance(column.type, (ARRAY, JSONB)):
                column.type = JSON()
        metadata.create_all(self.engine)
        self.db = Session(self.engine, expire_on_commit=False)
        self.user = SimpleNamespace(id="assistant-user")
        app.dependency_overrides[get_current_user] = lambda: self.user
        app.dependency_overrides[get_db] = lambda: self.db
        self.client = TestClient(app)
        self.db.add(AiProvider(
            userId=self.user.id, kind="lmstudio", label="LM Studio", baseUrl="http://127.0.0.1:1234/v1",
            model="local-test-model", isDefault=True,
        ))
        self.db.flush()
        self.provider_request = patch.object(openai_adapter, "request_provider_json", new_callable=AsyncMock)
        self.mock_provider = self.provider_request.start()
        self.return_generation()

    def tearDown(self) -> None:
        self.provider_request.stop()
        self.client.close()
        app.dependency_overrides.clear()
        self.db.close()
        self.engine.dispose()

    def return_generation(self, *, tasks: list | None = None, analysis: str = "Plan proposé.") -> None:
        self.mock_provider.return_value = {
            "choices": [{"finish_reason": "stop", "message": {"content": json.dumps({
                "analysis": analysis, "tasks": [GENERATED_TASK] if tasks is None else tasks,
            })}}]
        }

    def preview(self, **changes):
        return self.client.post("/api/assistant/preview", json={
            "prompt": "Prépare le rapport jeudi à 10 heures.",
            "date": SELECTED_DATE,
            "mode": "tasks",
            **changes,
        })

    def seed_log(self, user_id: str, day: str, summary: str) -> None:
        self.db.execute(self.logs_table.insert().values(
            userId=user_id, date=date.fromisoformat(day), status="SUBMITTED",
            textSummary=summary, voiceTranscript=f"vocal {summary}",
        ))
        self.db.flush()

    def seed_task(self, user_id: str, day: str, title: str) -> None:
        self.db.add(Task(userId=user_id, date=date.fromisoformat(day), title=title))
        self.db.flush()

    def provider_payload(self) -> str:
        provider_request = self.mock_provider.await_args.args[0]
        return json.dumps(provider_request.payload, default=str)

    def test_preview_returns_tasks_without_creating_or_changing_records(self) -> None:
        self.seed_task(self.user.id, SELECTED_DATE, "Tâche existante")
        self.seed_log(self.user.id, SELECTED_DATE, "Résumé existant")

        response = self.preview()

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["tasks"], [GENERATED_TASK])
        self.assertEqual(self.db.scalar(select(func.count()).select_from(Task)), 1)
        self.assertEqual(self.db.scalar(select(Task.title)), "Tâche existante")
        self.assertEqual(self.db.scalar(select(DailyLog.status)), "SUBMITTED")

    def test_day_analysis_includes_only_the_authenticated_users_selected_day(self) -> None:
        self.seed_log(self.user.id, SELECTED_DATE, "OWN_DAY_MARKER")
        self.seed_task(self.user.id, SELECTED_DATE, "OWN_TASK_MARKER")
        self.seed_log("other-user", SELECTED_DATE, "PRIVATE_OTHER_USER_MARKER")
        self.seed_task("other-user", SELECTED_DATE, "PRIVATE_OTHER_TASK_MARKER")
        self.seed_log(self.user.id, "2026-09-30", "OUTSIDE_DAY_MARKER")
        self.return_generation(tasks=[])

        response = self.preview(mode="day", prompt="Analyse ma journée")

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual((response.json()["from"], response.json()["to"]), (SELECTED_DATE, SELECTED_DATE))
        provider_payload = self.provider_payload()
        self.assertIn("OWN_DAY_MARKER", provider_payload)
        self.assertIn("OWN_TASK_MARKER", provider_payload)
        for excluded in ("PRIVATE_OTHER_USER_MARKER", "PRIVATE_OTHER_TASK_MARKER", "OUTSIDE_DAY_MARKER"):
            self.assertNotIn(excluded, provider_payload)

    def test_week_analysis_includes_seven_days_ending_selected_date_across_months(self) -> None:
        self.seed_log(self.user.id, "2026-09-28", "WEEK_MONDAY_MARKER")
        self.seed_log(self.user.id, "2026-10-04", "WEEK_SUNDAY_MARKER")
        self.seed_log(self.user.id, "2026-09-27", "PREVIOUS_WEEK_MARKER")
        self.seed_log(self.user.id, "2026-10-05", "NEXT_WEEK_MARKER")
        self.return_generation(tasks=[])

        response = self.preview(mode="week", date="2026-10-04", prompt="Analyse ma semaine")

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual((response.json()["from"], response.json()["to"]), ("2026-09-28", "2026-10-04"))
        provider_payload = self.provider_payload()
        self.assertIn("WEEK_MONDAY_MARKER", provider_payload)
        self.assertIn("WEEK_SUNDAY_MARKER", provider_payload)
        self.assertNotIn("PREVIOUS_WEEK_MARKER", provider_payload)
        self.assertNotIn("NEXT_WEEK_MARKER", provider_payload)

    def test_invalid_request_never_calls_the_model(self) -> None:
        for changes in ({"date": "2026-02-30"}, {"mode": "month"}, {"prompt": "   "}):
            with self.subTest(changes=changes):
                response = self.preview(**changes)
                self.assertEqual(response.status_code, 422, response.text)
        self.mock_provider.assert_not_awaited()

    def test_invalid_model_json_never_becomes_a_task(self) -> None:
        for content in ("not json", "[]", '{"analysis": "Plan", "tasks": "bad"}'):
            with self.subTest(content=content):
                self.mock_provider.return_value = {"choices": [{"message": {"content": content}}]}
                response = self.preview()
                self.assertEqual(response.status_code, 502, response.text)
        self.assertEqual(self.db.scalar(select(func.count()).select_from(Task)), 0)

    def test_invalid_proposed_task_fields_are_rejected(self) -> None:
        for changes in (
            {"title": "   "}, {"date": "2026-02-30"}, {"startTime": "25:00"},
            {"startTime": "11:00", "endTime": "10:00"}, {"startTime": None, "endTime": "11:00"},
            {"estimatedMinutes": -1}, {"estimatedMinutes": 10081}, {"importance": "URGENT"},
        ):
            with self.subTest(changes=changes):
                self.return_generation(tasks=[{**GENERATED_TASK, **changes}])
                response = self.preview()
                self.assertEqual(response.status_code, 502, response.text)
        self.assertEqual(self.db.scalar(select(func.count()).select_from(Task)), 0)

    def test_valid_start_only_and_undated_backlog_tasks_are_preserved(self) -> None:
        proposed_tasks = [
            {**GENERATED_TASK, "endTime": None},
            {**GENERATED_TASK, "date": None, "startTime": None, "endTime": None},
        ]
        self.return_generation(tasks=proposed_tasks)

        response = self.preview()

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["tasks"], proposed_tasks)

    def test_model_actions_and_incomplete_responses_are_rejected(self) -> None:
        content = json.dumps({"analysis": "Plan", "tasks": [GENERATED_TASK]})
        for choice in (
            {"finish_reason": "length", "message": {"content": content}},
            {"finish_reason": "stop", "message": {"content": content, "tool_calls": [{"function": {"name": "create_tasks"}}]}},
            {"finish_reason": "stop", "message": {"content": '{"analysis":"first","analysis":"second","tasks":[]}'}},
            {"finish_reason": "stop", "message": {"content": json.dumps({"analysis": "Plan", "tasks": [{**GENERATED_TASK, "userId": "another-user"}]})}},
            {"finish_reason": "stop", "message": {"content": json.dumps({"analysis": "Plan", "tasks": [GENERATED_TASK] * 21})}},
        ):
            with self.subTest(choice=choice):
                self.mock_provider.return_value = {"choices": [choice]}
                self.assertEqual(self.preview().status_code, 502)
        self.assertEqual(self.db.scalar(select(func.count()).select_from(Task)), 0)

    def test_large_analysis_context_is_bounded_and_reports_missing_journals(self) -> None:
        self.seed_log(self.user.id, SELECTED_DATE, "x" * 2000)
        for number in range(101):
            self.seed_task(self.user.id, SELECTED_DATE, f"Task {number}")
        self.return_generation(tasks=[])

        response = self.preview(mode="week")

        self.assertEqual(response.status_code, 200, response.text)
        payload = self.mock_provider.await_args.args[0].payload
        context = json.loads(payload["messages"][1]["content"])["contexte"]
        self.assertEqual(len(context["days"]), 7)
        self.assertTrue(context["tasksTruncated"])
        self.assertTrue(context["textTruncated"])
        self.assertEqual(sum(len(day["tasks"]) for day in context["days"]), 100)
        self.assertFalse(context["days"][0]["journalPresent"])
        self.assertIsNone(context["days"][0]["journal"])
        self.assertTrue(context["days"][-1]["journalPresent"])

    def test_preview_without_configured_provider_explains_how_to_configure_one(self) -> None:
        self.db.query(AiProvider).delete()
        self.db.flush()

        response = self.preview()

        self.assertEqual(response.status_code, 409, response.text)
        self.assertIn("Réglages", response.json()["error"])
        self.mock_provider.assert_not_awaited()

    def test_preview_uses_the_stored_model(self) -> None:
        response = self.preview()

        self.assertEqual(response.status_code, 200, response.text)
        provider_request = self.mock_provider.await_args.args[0]
        self.assertEqual(provider_request.url, "http://127.0.0.1:1234/v1/chat/completions")
        self.assertEqual(provider_request.payload["model"], "local-test-model")

    def test_provider_errors_have_safe_messages(self) -> None:
        for status_code in (503, 504):
            with self.subTest(status_code=status_code):
                self.mock_provider.side_effect = AiProviderError(status_code, "LM Studio unavailable")
                response = self.preview()
                self.assertEqual(response.status_code, status_code, response.text)
                self.assertNotIn("PRIVATE_API_KEY", response.text)

    def test_assistant_preview_requires_authentication(self) -> None:
        app.dependency_overrides.pop(get_current_user)

        preview_response = self.preview()

        self.assertEqual(preview_response.status_code, 401)
        self.mock_provider.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
