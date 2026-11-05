"""Second brain: notes are generated without clobbering user text, and search is explainable."""

from datetime import date, datetime
import tempfile
import time
import unittest
from pathlib import Path
from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.core.knowledge.managed_block import MANAGED_END, merge_managed_note
from app.core.knowledge.markdown_note import extract_hashtags, extract_wikilink_targets, parse_note
from app.core.knowledge.note_capture import build_captured_note
from app.core.knowledge.note_indexing import index_note
from app.core.knowledge.note_paths import slugify_title
from app.core.knowledge.projected_notes import DaySnapshot, ObjectiveSnapshot, TaskSnapshot
from app.core.knowledge.search_index import SearchQuery, build_search_index, search_notes
from app.core.knowledge.tracker_snapshot import TrackerSnapshot
from app.core.knowledge.vault_store import VaultPathError, VaultStore
from app.core.knowledge.vault_sync import sync_tracker_notes
from app.database import get_db
from app.main import app
from app.models import DailyLog, Objective, Tag, Task, ThinkingNote, ThinkingNoteTag, WeeklyRecap, Course, CourseDeadline
from app.routers.knowledge import get_vault_store
from app.security import get_current_user
from tests.sqlite_harness import create_sqlite_session

MONDAY = date(2026, 11, 2)


def sample_snapshot(recap: str = "Bonne séance sur les martingales.") -> TrackerSnapshot:
    task = TaskSnapshot("Refaire les exercices 3 et 4", "DONE", MONDAY, "obj1", "Processus stochastiques")
    open_task = TaskSnapshot("Lire le chapitre 5", "PLANNED", None, "obj1", "Processus stochastiques")
    return TrackerSnapshot(
        days=[DaySnapshot(MONDAY, recap, [task], blockers=["Fatigue en fin de journée"])],
        week_recaps={"2026-W45": "Semaine régulière."},
        objectives=[ObjectiveSnapshot("obj1", "Processus stochastiques", "Maîtriser les martingales", None, "ACTIVE", "QUARTER", [task, open_task])],
        ideas=[],
    )


class MarkdownTests(unittest.TestCase):
    def test_frontmatter_links_and_tags(self) -> None:
        note = parse_note("---\ntags: [maths]\ndate: 2026-11-02\n---\n# Titre\nVoir [[Martingales|ici]] et [[Dossier/Note#Section]] #proba #2026\n```\n[[ignoré]] #code\n```")

        self.assertEqual(note.frontmatter, {"tags": ["maths"], "date": "2026-11-02"})
        self.assertEqual(extract_wikilink_targets(note.body), ["Martingales", "Dossier/Note"])
        self.assertEqual(extract_hashtags(note.body), ["proba"])

    def test_invalid_yaml_does_not_block_reading(self) -> None:
        self.assertEqual(parse_note("---\n: [\n---\nCorps").body, "Corps")

    def test_slug_keeps_accents_and_removes_forbidden_characters(self) -> None:
        self.assertEqual(slugify_title('Améliorer: "processus" / stochastiques?'), "Améliorer processus stochastiques")


class ManagedBlockTests(unittest.TestCase):
    def test_user_text_and_extra_frontmatter_survive_regeneration(self) -> None:
        created = merge_managed_note(None, {"type": "journal", "tracker_id": "journal:x"}, "Version 1")
        edited = created.text.replace("type: journal", "type: journal\nmood: calme") + "\n## Mes notes\nÀ garder absolument.\n"

        regenerated = merge_managed_note(edited, {"type": "journal", "tracker_id": "journal:x"}, "Version 2")

        self.assertEqual(regenerated.kind, "updated")
        self.assertIn("Version 2", regenerated.text)
        self.assertNotIn("Version 1", regenerated.text)
        self.assertIn("À garder absolument.", regenerated.text)
        self.assertIn("mood: calme", regenerated.text)
        self.assertEqual(merge_managed_note(regenerated.text, {"type": "journal", "tracker_id": "journal:x"}, "Version 2").kind, "unchanged")

    def test_removed_markers_are_a_conflict_and_nothing_is_written(self) -> None:
        created = merge_managed_note(None, {"tracker_id": "x"}, "Généré")
        user_rewrite = created.text.replace(MANAGED_END, "")

        outcome = merge_managed_note(user_rewrite, {"tracker_id": "x"}, "Nouveau")

        self.assertEqual(outcome.kind, "conflict")
        self.assertEqual(outcome.text, user_rewrite)


class VaultSyncTests(unittest.TestCase):
    def setUp(self) -> None:
        self.directory = tempfile.TemporaryDirectory()
        self.store = VaultStore(Path(self.directory.name))

    def tearDown(self) -> None:
        self.directory.cleanup()

    def test_sync_is_idempotent_and_links_notes(self) -> None:
        first = sync_tracker_notes(self.store, sample_snapshot())
        second = sync_tracker_notes(self.store, sample_snapshot())

        self.assertEqual((first.created, first.updated, first.conflicts), (3, 0, []))
        self.assertEqual((second.created, second.updated, second.unchanged), (0, 0, 3))
        journal = self.store.read_text("Tracker/Journal/2026-11-02.md")
        self.assertIn("- [x] Refaire les exercices 3 et 4 · [[Tracker/Objectifs/Processus stochastiques|Processus stochastiques]]", journal)
        self.assertIn("[[Tracker/Semaines/2026-W45|2026-W45]]", journal)
        objective = self.store.read_text("Tracker/Objectifs/Processus stochastiques.md")
        self.assertIn("- [ ] Lire le chapitre 5 — à planifier", objective)
        self.assertIn("Semaine régulière.", self.store.read_text("Tracker/Semaines/2026-W45.md"))

    def test_moved_note_is_updated_in_place_and_user_notes_untouched(self) -> None:
        sync_tracker_notes(self.store, sample_snapshot())
        original = self.store.root / "Tracker/Journal/2026-11-02.md"
        moved = self.store.root / "Tracker/Archive/lundi.md"
        moved.parent.mkdir(parents=True)
        original.rename(moved)
        self.store.write_atomic("Perso/Réflexion.md", "# Ma note\nNe pas toucher.")

        report = sync_tracker_notes(self.store, sample_snapshot(recap="Récap corrigé."))

        self.assertEqual(report.created, 0)
        self.assertFalse(original.exists())
        self.assertIn("Récap corrigé.", moved.read_text(encoding="utf-8"))
        self.assertEqual(self.store.read_text("Perso/Réflexion.md"), "# Ma note\nNe pas toucher.")

    def test_paths_cannot_escape_the_vault(self) -> None:
        for path in ("../secret.md", "/etc/passwd.md", "Notes/script.py"):
            with self.subTest(path=path), self.assertRaises(VaultPathError):
                self.store.resolve(path)

    def test_create_new_never_overwrites(self) -> None:
        first_path = self.store.create_new("Inbox/Idée.md", "A")
        second_path = self.store.create_new("Inbox/Idée.md", "B")

        self.assertEqual((first_path, second_path), ("Inbox/Idée.md", "Inbox/Idée (2).md"))
        self.assertEqual(self.store.read_text(first_path), "A")


class SearchTests(unittest.TestCase):
    def build_index(self):
        now = time.time()
        notes = {
            "Cours/Martingales.md": "---\ntags: [proba]\n---\n# Martingales\nThéorème d'arrêt optionnel et exercices.",
            "Tracker/Journal/2026-11-02.md": "---\ntype: journal\ndate: '2026-11-02'\n---\n# Journal\n- [x] Exercices sur les martingales · [[Cours/Martingales|cours]]",
            "Cuisine.md": "# Recette\nPâtes à la sauce tomate.",
        }
        return build_search_index([index_note(path, text, now) for path, text in notes.items()]), now

    def test_accent_and_plural_insensitive_match_with_reasons(self) -> None:
        index, now = self.build_index()

        hits = search_notes(index, SearchQuery(text="martingale theoreme", now_timestamp=now))

        self.assertEqual(hits[0].path, "Cours/Martingales.md")
        self.assertIn("titre", hits[0].reasons)
        self.assertNotIn("Cuisine.md", [hit.path for hit in hits])
        journal_hit = next(hit for hit in hits if hit.path.startswith("Tracker"))
        self.assertTrue(any(reason.startswith("lié à") for reason in journal_hit.reasons))

    def test_type_and_date_filters(self) -> None:
        index, now = self.build_index()

        hits = search_notes(index, SearchQuery(text="martingales", now_timestamp=now, note_types=frozenset({"journal"}), date_from="2026-11-01"))

        self.assertEqual([hit.path for hit in hits], ["Tracker/Journal/2026-11-02.md"])

    def test_capture_builds_metadata_automatically(self) -> None:
        captured = build_captured_note("Idée : relier Itô et martingales #proba", datetime(2026, 11, 3, 9, 30))

        self.assertEqual(captured.relative_path, "Inbox/2026-11-03 0930 Idée relier Itô et martingales proba.md")
        note = parse_note(captured.text)
        self.assertEqual(note.frontmatter["tags"], ["inbox", "proba"])
        self.assertEqual(note.frontmatter["date"], "2026-11-03")


class KnowledgeApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.directory = tempfile.TemporaryDirectory()
        self.db = create_sqlite_session(Task, Objective, DailyLog, WeeklyRecap, ThinkingNote, ThinkingNoteTag, Tag, Course, CourseDeadline)
        self.user = SimpleNamespace(id="kb-user")
        app.dependency_overrides[get_current_user] = lambda: self.user
        app.dependency_overrides[get_db] = lambda: self.db
        app.dependency_overrides[get_vault_store] = lambda: VaultStore(Path(self.directory.name))
        self.client = TestClient(app)

    def tearDown(self) -> None:
        self.client.close()
        app.dependency_overrides.clear()
        self.db.close()
        self.db.bind.dispose()
        self.directory.cleanup()

    def test_sync_capture_search_and_read(self) -> None:
        self.db.add(Objective(id="o1", userId=self.user.id, title="Processus stochastiques", horizon="QUARTER"))
        self.db.add(Task(userId=self.user.id, title="Revoir le chapitre sur les martingales", date=MONDAY, status="DONE", objectiveId="o1"))
        self.db.add(Task(userId="other", title="SECRET_OTHER_USER", date=MONDAY))
        self.db.add(ThinkingNote(id="n1", userId=self.user.id, content="Lien entre filtrations et information", createdAt=datetime(2026, 10, 1)))
        self.db.flush()

        report = self.client.post("/api/knowledge/sync").json()["report"]
        captured = self.client.post("/api/knowledge/notes", json={"text": "Martingale = jeu équitable #intuition"}).json()
        results = self.client.get("/api/knowledge/search", params={"q": "martingales"}).json()["results"]
        note = self.client.get("/api/knowledge/note", params={"path": "Tracker/Journal/2026-11-02.md"}).json()

        self.assertEqual(report["created"], 4)
        self.assertTrue(captured["path"].startswith("Inbox/"))
        self.assertIn(captured["path"], [result["path"] for result in results])
        self.assertIn("Revoir le chapitre", note["body"])
        self.assertNotIn("SECRET_OTHER_USER", note["body"])
        self.assertIn("Tracker/Objectifs/Processus stochastiques.md", [link["path"] for link in note["links"]])
        self.assertEqual(self.client.get("/api/knowledge/note", params={"path": "../x.md"}).status_code, 400)
        self.assertEqual(self.client.get("/api/knowledge/status").json()["managedCount"], 4)

    def test_retried_phone_note_is_created_once(self) -> None:
        body = {"text": "Note dictée hors ligne", "requestId": "3f2b6c1e-8f4a-4d7e-9a51-0c2d6e7f8a90"}

        first = self.client.post("/api/knowledge/notes", json=body).json()
        second = self.client.post("/api/knowledge/notes", json=body).json()

        self.assertEqual(first["path"], second["path"])
        self.assertEqual(first["captureId"], body["requestId"])
        self.assertEqual(len(list(Path(self.directory.name, "Inbox").glob("*.md"))), 1)


if __name__ == "__main__":
    unittest.main()
