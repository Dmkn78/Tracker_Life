"""Courses: one-field creation, important dates, calendar export, week board and vault integration."""

from datetime import date, datetime, timedelta, timezone
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.core.courses.calendar_export import CalendarDeadline, build_ics_calendar
from app.core.knowledge.vault_store import VaultStore
from app.database import get_db
from app.main import app
from app.models import Course, CourseDeadline, DailyLog, Objective, Tag, Task, ThinkingNote, ThinkingNoteTag, WeeklyRecap
from app.routers.knowledge import get_vault_store
from app.security import get_current_user
from tests.sqlite_harness import create_sqlite_session


class CalendarExportTests(unittest.TestCase):
    def test_all_day_and_timed_dates_with_escaping_and_folding(self) -> None:
        deadlines = [
            CalendarDeadline("d1", "Partiel; chapitre 1, 2", "exam", date(2026, 12, 14), None, 60, "Probabilités", None),
            CalendarDeadline("d2", "Rendu du projet " + "x" * 80, "assignment", date(2026, 12, 15), "09:30", 90, None, "Salle B\nPrévoir l'imprimé"),
        ]

        calendar = build_ics_calendar(deadlines, datetime(2026, 11, 5, 8, 0, tzinfo=timezone.utc))

        self.assertIn("DTSTART;VALUE=DATE:20261214\r\nDTEND;VALUE=DATE:20261215", calendar)
        self.assertIn("SUMMARY:Examen — Probabilités · Partiel\; chapitre 1\\, 2", calendar)
        self.assertIn("DTSTART:20261215T093000\r\nDTEND:20261215T110000", calendar)
        self.assertIn("DESCRIPTION:Salle B\\nPrévoir l'imprimé", calendar)
        self.assertTrue(all(len(line.encode()) <= 75 for line in calendar.split("\r\n")))
        self.assertTrue(calendar.startswith("BEGIN:VCALENDAR") and calendar.endswith("END:VCALENDAR\r\n"))


class CoursesApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.directory = tempfile.TemporaryDirectory()
        self.db = create_sqlite_session(Course, CourseDeadline, Task, Objective, DailyLog, WeeklyRecap, ThinkingNote, ThinkingNoteTag, Tag)
        app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id="student")
        app.dependency_overrides[get_db] = lambda: self.db
        app.dependency_overrides[get_vault_store] = lambda: VaultStore(Path(self.directory.name))
        self.client = TestClient(app)

    def tearDown(self) -> None:
        self.client.close()
        app.dependency_overrides.clear()
        self.db.close()
        self.db.bind.dispose()
        self.directory.cleanup()

    def test_course_deadlines_flow_into_listing_export_week_and_vault(self) -> None:
        in_three_days = date.today() + timedelta(days=3)
        course = self.client.post("/api/courses", json={"name": "Processus stochastiques"}).json()["course"]
        exam = self.client.post("/api/courses/deadlines", json={"courseId": course["id"], "title": "Partiel", "kind": "exam", "date": in_three_days.isoformat(), "time": "14:00"}).json()["deadline"]
        self.client.post("/api/courses/deadlines", json={"title": "Inscription au stage", "date": in_three_days.isoformat()})

        listing = self.client.get("/api/courses").json()
        calendar = self.client.get("/api/courses/calendar.ics")
        week = self.client.get(f"/api/week?weekId={in_three_days.isocalendar()[0]}-W{in_three_days.isocalendar()[1]:02d}").json()
        self.client.post("/api/knowledge/sync")

        self.assertEqual([deadline["title"] for deadline in listing["deadlines"]], ["Inscription au stage", "Partiel"])
        self.assertEqual(exam["time"], "14:00")
        self.assertEqual(calendar.headers["content-type"], "text/calendar; charset=utf-8")
        self.assertIn("SUMMARY:Examen — Processus stochastiques · Partiel", calendar.text)
        day = next(day for day in week["days"] if day["date"] == in_three_days.isoformat())
        self.assertEqual([(deadline["title"], deadline["courseName"]) for deadline in day["deadlines"]], [("Inscription au stage", None), ("Partiel", "Processus stochastiques")])
        course_note = (Path(self.directory.name) / "Tracker/Cours/Processus stochastiques.md").read_text(encoding="utf-8")
        self.assertIn("**Examen** : Partiel", course_note)

    def test_update_delete_and_ownership(self) -> None:
        course = self.client.post("/api/courses", json={"name": "Analyse"}).json()["course"]
        deadline = self.client.post("/api/courses/deadlines", json={"courseId": course["id"], "title": "TD noté", "date": "2026-12-01", "time": "08:00"}).json()["deadline"]

        updated = self.client.patch("/api/courses/deadlines", json={"id": deadline["id"], "time": None, "kind": "assignment"}).json()["deadline"]
        self.assertEqual((updated["time"], updated["kind"]), (None, "assignment"))
        self.db.add(Course(id="foreign", userId="other", name="Privé"))
        self.db.flush()
        self.assertEqual(self.client.post("/api/courses/deadlines", json={"courseId": "foreign", "title": "x", "date": "2026-12-01"}).status_code, 404)
        self.assertEqual(self.client.patch("/api/courses", json={"id": "foreign", "name": "y"}).status_code, 404)
        self.assertEqual(self.client.post("/api/courses/deadlines", json={"title": "x", "date": "2026-12-01", "time": "25:00"}).status_code, 422)

        self.client.delete(f"/api/courses?id={course['id']}")

        self.assertEqual(self.db.query(CourseDeadline).count(), 0)


if __name__ == "__main__":
    unittest.main()
