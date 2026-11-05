"""The weekly board shows plan vs done and stores recaps without touching other log fields."""

from datetime import date
from types import SimpleNamespace
import unittest

from fastapi.testclient import TestClient

from app.database import get_db
from app.main import app
from app.models import DailyLog, Objective, Task, WeeklyRecap, Course, CourseDeadline
from app.security import get_current_user
from tests.sqlite_harness import create_sqlite_session

WEEK_ID = "2026-W45"
MONDAY = date(2026, 11, 2)


class WeekApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.db = create_sqlite_session(Task, Objective, DailyLog, WeeklyRecap, Course, CourseDeadline)
        self.user = SimpleNamespace(id="week-user")
        app.dependency_overrides[get_current_user] = lambda: self.user
        app.dependency_overrides[get_db] = lambda: self.db
        self.client = TestClient(app)

    def tearDown(self) -> None:
        self.client.close()
        app.dependency_overrides.clear()
        self.db.close()
        self.db.bind.dispose()

    def add_task(self, title: str, day: date | None, status: str = "PLANNED", user_id: str = "week-user") -> None:
        self.db.add(Task(userId=user_id, title=title, date=day, status=status))
        self.db.flush()

    def test_board_groups_tasks_by_day_and_lists_open_inbox(self) -> None:
        self.add_task("Réviser les martingales", MONDAY, "DONE")
        self.add_task("Exercices 3 et 4", MONDAY)
        self.add_task("Lire un article", date(2026, 11, 8), "NOT_DONE")
        self.add_task("Idée sans date", None)
        self.add_task("Vieille idée finie", None, "DONE")
        self.add_task("Autre semaine", date(2026, 11, 9))
        self.add_task("Privé", MONDAY, user_id="someone-else")

        board = self.client.get(f"/api/week?weekId={WEEK_ID}").json()

        self.assertEqual(board["previousWeekId"], "2026-W44")
        self.assertEqual(board["nextWeekId"], "2026-W46")
        self.assertEqual([day["date"] for day in board["days"]][0], "2026-11-02")
        self.assertEqual([task["title"] for task in board["days"][0]["tasks"]], ["Réviser les martingales", "Exercices 3 et 4"])
        self.assertEqual([task["title"] for task in board["inbox"]], ["Idée sans date"])
        self.assertEqual(board["summary"], {"planned": 3, "done": 1, "dropped": 1, "open": 1, "completionRate": 0.333})

    def test_day_recap_only_changes_the_summary(self) -> None:
        self.db.add(DailyLog(userId=self.user.id, date=MONDAY, status="SUBMITTED", energy=70, mainBlocker="Fatigue"))
        self.db.flush()

        response = self.client.put("/api/week/recap", json={"date": "2026-11-02", "text": "  Bonne séance.  "})

        self.assertEqual(response.status_code, 200, response.text)
        log = self.db.query(DailyLog).one()
        self.assertEqual((log.textSummary, log.status, log.energy, log.mainBlocker), ("Bonne séance.", "SUBMITTED", 70, "Fatigue"))
        board = self.client.get(f"/api/week?weekId={WEEK_ID}").json()
        self.assertEqual(board["days"][0]["recap"], "Bonne séance.")

    def test_day_recap_creates_a_draft_log_and_empty_text_creates_nothing(self) -> None:
        self.client.put("/api/week/recap", json={"date": "2026-11-03", "text": ""})
        self.assertEqual(self.db.query(DailyLog).count(), 0)

        self.client.put("/api/week/recap", json={"date": "2026-11-03", "text": "Journée courte"})

        self.assertEqual(self.db.query(DailyLog).one().status, "DRAFT")

    def test_week_recap_upsert_and_clear(self) -> None:
        self.client.put("/api/week/recap", json={"weekId": WEEK_ID, "text": "Semaine dense"})
        self.client.put("/api/week/recap", json={"weekId": WEEK_ID, "text": "Semaine dense mais utile"})
        self.assertEqual(self.client.get(f"/api/week?weekId={WEEK_ID}").json()["recap"], "Semaine dense mais utile")

        self.client.put("/api/week/recap", json={"weekId": WEEK_ID, "text": " "})

        self.assertIsNone(self.client.get(f"/api/week?weekId={WEEK_ID}").json()["recap"])

    def test_invalid_week_is_refused(self) -> None:
        self.assertEqual(self.client.get("/api/week?weekId=2026-W60").status_code, 422)
        self.assertEqual(self.client.put("/api/week/recap", json={"text": "x"}).status_code, 400)


if __name__ == "__main__":
    unittest.main()
