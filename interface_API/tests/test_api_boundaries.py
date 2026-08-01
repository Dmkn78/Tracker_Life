from __future__ import annotations

import unittest

from fastapi.testclient import TestClient

from app.main import app


class ApiBoundaryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app)

    def test_health_exposes_only_public_state(self) -> None:
        response = self.client.get("/api/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(set(response.json()), {"ok", "usingDevAccessKey"})

    def test_transcription_requires_authentication(self) -> None:
        response = self.client.post(
            "/api/transcribe",
            files={"file": ("voice.webm", b"audio", "audio/webm")},
        )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"error": "Unauthorized"})


if __name__ == "__main__":
    unittest.main()
