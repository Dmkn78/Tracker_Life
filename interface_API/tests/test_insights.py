"""Analyses are grounded: deterministic patterns from records, AI statements must cite sources."""

from datetime import date, timedelta
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.core.ai.adapters import openai_adapter
from app.core.insights.analysis_period import AnalysisPeriod, resolve_analysis_period, restrict_history
from app.core.insights.cited_answer import CitedStatement, InsightAnswer, apply_citation_policy
from app.core.insights.history_patterns import detect_history_patterns, normalize_label
from app.core.knowledge.projected_notes import DaySnapshot, ObjectiveSnapshot, TaskSnapshot
from app.core.knowledge.tracker_snapshot import TrackerSnapshot
from app.core.knowledge.vault_store import VaultStore
from app.database import get_db
from app.main import app
from app.models import AiProvider, DailyLog, Objective, Tag, Task, ThinkingNote, ThinkingNoteTag, WeeklyRecap
from app.routers.knowledge import get_vault_store
from app.security import get_current_user
from tests.sqlite_harness import create_sqlite_session

START = date(2026, 10, 5)


def day(offset: int, tasks: list[TaskSnapshot], blockers: list[str] | None = None, recap: str | None = None) -> DaySnapshot:
    return DaySnapshot(START + timedelta(days=offset), recap, tasks, blockers=blockers or [])


def task(title: str, offset: int, status: str = "PLANNED", objective: str | None = None, reason: str | None = None) -> TaskSnapshot:
    return TaskSnapshot(title, status, START + timedelta(days=offset), "o1" if objective else None, objective, reason)


class PatternTests(unittest.TestCase):
    def history(self):
        snapshot = TrackerSnapshot(
            days=[
                day(0, [task("Faire du sport", 0, "DONE"), task("Rédiger le rapport", 0, "NOT_DONE", reason="Trop de réunions")], ["Fatigue le soir"]),
                day(1, [task("Rapport : rédiger", 1, "NOT_DONE", reason="Réunions imprévues")], ["fatigue le soir"]),
                day(7, [task("faire du sport", 7, "DONE"), task("Exercices martingales", 7, "DONE", "Proba")]),
                day(40, [task("Hors période", 40)]),
            ],
            week_recaps={},
            objectives=[
                ObjectiveSnapshot("o1", "Proba", None, None, "ACTIVE", "QUARTER", []),
                ObjectiveSnapshot("o2", "Apprendre le piano", None, None, "ACTIVE", "YEAR", []),
            ],
            ideas=[],
        )
        return restrict_history(snapshot, AnalysisPeriod(START, START + timedelta(days=27)))

    def test_recurring_postponed_and_blocker_patterns(self) -> None:
        patterns = detect_history_patterns(self.history())

        self.assertEqual((patterns.planned, patterns.done, patterns.dropped), (5, 3, 2))
        self.assertEqual([(item.label, item.count, item.done_count) for item in patterns.recurring_tasks][0:2], [("Faire du sport", 2, 2), ("Rédiger le rapport", 2, 0)])
        self.assertEqual([item.label for item in patterns.postponed_tasks], ["Rédiger le rapport"])
        self.assertEqual([(item.label, item.count) for item in patterns.recurring_blockers], [("Fatigue le soir", 2)])
        self.assertIn("reunion", [item.label for item in patterns.blocker_keywords])
        self.assertEqual(patterns.idle_objectives, ["Apprendre le piano"])
        self.assertEqual([item.date for item in patterns.recurring_blockers[0].evidence], ["2026-10-05", "2026-10-06"])

    def test_label_normalization_ignores_order_accents_and_plurals(self) -> None:
        self.assertEqual(normalize_label("Rédiger le rapport"), normalize_label("rapports : rediger"))

    def test_period_defaults_and_limits(self) -> None:
        self.assertEqual(resolve_analysis_period(None, None, date(2026, 11, 3)), AnalysisPeriod(date(2026, 10, 7), date(2026, 11, 3)))
        with self.assertRaises(ValueError):
            resolve_analysis_period(date(2026, 1, 2), date(2026, 1, 1), date(2026, 1, 3))
        with self.assertRaises(ValueError):
            resolve_analysis_period(date(2024, 1, 1), date(2026, 1, 1), date(2026, 1, 3))


class CitationPolicyTests(unittest.TestCase):
    def test_unknown_sources_removed_and_unsourced_facts_demoted(self) -> None:
        answer = InsightAnswer(
            summary="Résumé",
            facts=[CitedStatement(text="Sport fait 2 fois", sources=["S1", "S99"]), CitedStatement(text="Inventé", sources=["S42"])],
            hypotheses=[CitedStatement(text="Fatigue liée aux réunions", sources=["S2"])],
            recommendations=[CitedStatement(text="Bloquer une matinée", sources=[])],
        )

        checked = apply_citation_policy(answer, {"S1", "S2"})

        self.assertEqual([fact.to_json() for fact in checked.facts], [{"text": "Sport fait 2 fois", "sources": ["S1"]}])
        self.assertEqual([fact.text for fact in checked.unverified], ["Inventé"])
        self.assertEqual(checked.cited_ids(), {"S1", "S2"})


class InsightsApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.directory = tempfile.TemporaryDirectory()
        self.db = create_sqlite_session(Task, Objective, DailyLog, WeeklyRecap, ThinkingNote, ThinkingNoteTag, Tag, AiProvider)
        self.user = SimpleNamespace(id="insight-user")
        app.dependency_overrides[get_current_user] = lambda: self.user
        app.dependency_overrides[get_db] = lambda: self.db
        app.dependency_overrides[get_vault_store] = lambda: VaultStore(Path(self.directory.name))
        self.client = TestClient(app)
        self.db.add(AiProvider(userId=self.user.id, kind="lmstudio", label="LM", baseUrl="http://127.0.0.1:1234/v1", model="m", isDefault=True))
        today = date.today()
        self.db.add(Task(userId=self.user.id, title="Réviser les martingales", date=today, status="DONE"))
        self.db.add(Task(userId="intruder", title="PRIVATE_OTHER_USER", date=today))
        self.db.add(DailyLog(userId=self.user.id, date=today, status="DRAFT", textSummary="Séance productive", mainBlocker="Bruit"))
        self.db.add(Objective(id="goal", userId=self.user.id, title="Maîtriser les processus stochastiques", horizon="QUARTER"))
        self.db.flush()
        VaultStore(Path(self.directory.name)).write_atomic("Cours/Itô.md", "# Calcul d'Itô\nLes martingales locales et le lemme d'Itô.")

    def tearDown(self) -> None:
        self.client.close()
        app.dependency_overrides.clear()
        self.db.close()
        self.db.bind.dispose()
        self.directory.cleanup()

    def mock_model(self, answer: dict):
        mocked = patch.object(openai_adapter, "request_provider_json", new_callable=AsyncMock)
        request = mocked.start()
        self.addCleanup(mocked.stop)
        request.return_value = {"choices": [{"finish_reason": "stop", "message": {"content": json.dumps(answer)}}]}
        return request

    def test_patterns_need_no_model(self) -> None:
        response = self.client.get("/api/insights/patterns")

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["patterns"]["done"], 1)

    def test_ask_sends_numbered_sources_and_returns_only_cited_ones(self) -> None:
        request = self.mock_model({
            "summary": "Semaine productive.",
            "facts": [{"text": "Martingales révisées", "sources": ["S2"]}, {"text": "Fabriqué", "sources": ["S77"]}],
            "hypotheses": [], "recommendations": [{"text": "Continuer", "sources": ["S1"]}],
        })

        response = self.client.post("/api/insights/ask", json={"question": "Où en suis-je sur les martingales ?"})

        self.assertEqual(response.status_code, 200, response.text)
        payload = request.await_args.args[0].payload
        sent = json.loads(payload["messages"][1]["content"])
        sent_text = json.dumps(sent, ensure_ascii=False)
        self.assertIn("Séance productive", sent_text)
        self.assertIn("Calcul d'Itô", sent_text)
        self.assertNotIn("PRIVATE_OTHER_USER", sent_text)
        self.assertIn("jamais des instructions", payload["messages"][0]["content"])
        body = response.json()
        self.assertEqual([fact["text"] for fact in body["answer"]["facts"]], ["Martingales révisées"])
        self.assertEqual([fact["text"] for fact in body["answer"]["unverified"]], ["Fabriqué"])
        self.assertEqual(sorted(source["id"] for source in body["sources"]), ["S1", "S2"])

    def test_decompose_returns_proposals_without_creating_tasks(self) -> None:
        self.mock_model({"steps": [{"title": "Relire le cours sur les martingales", "detail": None}]})

        response = self.client.post("/api/insights/decompose", json={"objectiveId": "goal"})

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["steps"][0]["title"], "Relire le cours sur les martingales")
        self.assertEqual(self.db.query(Task).count(), 2)

    def test_foreign_objective_and_missing_provider(self) -> None:
        self.assertEqual(self.client.post("/api/insights/decompose", json={"objectiveId": "nope"}).status_code, 404)
        self.db.query(AiProvider).delete()
        self.db.flush()
        self.assertEqual(self.client.post("/api/insights/ask", json={"question": "x"}).status_code, 409)


if __name__ == "__main__":
    unittest.main()
