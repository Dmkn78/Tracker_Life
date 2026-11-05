"""The simple goal list shows progress and the next open tasks of the user's goals only."""

from datetime import date
from types import SimpleNamespace
import unittest

from fastapi.testclient import TestClient

from app.database import get_db
from app.main import app
from app.models import Objective, Task
from app.security import get_current_user
from tests.sqlite_harness import create_sqlite_session


class GoalsApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.db = create_sqlite_session(Objective, Task)
        app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id="goal-user")
        app.dependency_overrides[get_db] = lambda: self.db
        self.client = TestClient(app)

    def tearDown(self) -> None:
        self.client.close()
        app.dependency_overrides.clear()
        self.db.close()
        self.db.bind.dispose()

    def test_goals_with_progress_and_open_tasks(self) -> None:
        self.db.add_all([
            Objective(id="g1", userId="goal-user", title="Maîtriser les processus stochastiques", horizon="QUARTER"),
            Objective(id="g2", userId="goal-user", title="Ancien objectif", horizon="YEAR", status="DONE"),
            Objective(id="g3", userId="goal-user", title="Archivé", horizon="YEAR", archived=True),
            Objective(id="g4", userId="intruder", title="Privé", horizon="YEAR"),
            Task(userId="goal-user", objectiveId="g1", title="Lire le chapitre", status="DONE", date=date(2026, 11, 2)),
            Task(userId="goal-user", objectiveId="g1", title="Exercices 3 et 4", date=date(2026, 11, 3)),
            Task(userId="goal-user", objectiveId="g1", title="Fiche de synthèse"),
        ])
        self.db.flush()

        goals = self.client.get("/api/goals").json()["goals"]

        self.assertEqual([goal["id"] for goal in goals], ["g1", "g2"])
        self.assertEqual((goals[0]["tasksDone"], goals[0]["tasksTotal"]), (1, 3))
        self.assertEqual([task["title"] for task in goals[0]["openTasks"]], ["Exercices 3 et 4", "Fiche de synthèse"])
        self.assertTrue(goals[1]["isDone"])


if __name__ == "__main__":
    unittest.main()
