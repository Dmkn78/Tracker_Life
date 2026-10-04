import asyncio
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
from app.main import app
from app.routers import transcribe
from app.security import get_current_user


class TranscribeApiTests(unittest.TestCase):
    def setUp(self):
        app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id="voice-test")
        self.client = TestClient(app)
        self.worker = patch.object(transcribe, "run_parakeet", new_callable=AsyncMock)
        self.mock_worker = self.worker.start()
        self.mock_worker.return_value = {"text": "Bonjour le monde.", "model": "parakeet-tdt-0.6b-v3"}

    def tearDown(self):
        self.worker.stop()
        self.client.close()
        app.dependency_overrides.clear()

    def upload(self, content=b"recording", content_type="audio/webm"):
        return self.client.post("/api/transcribe", files={"file": ("summary.webm", content, content_type)})

    def test_audio_is_transcribed_and_temporary_file_is_deleted(self):
        async def inspect_audio(path):
            self.assertEqual(path.read_bytes(), b"recording")
            self.audio_path = path
            return {"text": "Bonjour le monde.", "model": "parakeet-tdt-0.6b-v3"}
        self.mock_worker.side_effect = inspect_audio
        response = self.upload()
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["text"], "Bonjour le monde.")
        self.assertFalse(self.audio_path.exists())

    def test_rejects_empty_and_non_audio_files(self):
        self.assertEqual(self.upload(b"").status_code, 422)
        self.assertEqual(self.upload(content_type="text/html").status_code, 415)
        self.mock_worker.assert_not_awaited()

    def test_oversized_audio_never_reaches_model(self):
        with patch.object(transcribe, "get_settings", return_value=SimpleNamespace(max_audio_bytes=3)):
            self.assertEqual(self.upload().status_code, 413)
        self.mock_worker.assert_not_awaited()

    def test_busy_service_rejects_without_queuing_audio(self):
        with patch.object(transcribe, "transcription_slot", asyncio.Semaphore(0)):
            self.assertEqual(self.upload().status_code, 429)
        self.mock_worker.assert_not_awaited()

    def test_requires_authentication(self):
        app.dependency_overrides.clear()
        self.assertEqual(self.upload().status_code, 401)
        self.mock_worker.assert_not_awaited()


class ParakeetWorkerTests(unittest.IsolatedAsyncioTestCase):
    async def invoke_worker(self, process):
        with patch.object(Path, "is_file", return_value=True), patch.object(asyncio, "create_subprocess_exec", AsyncMock(return_value=process)):
            return await transcribe.run_parakeet(Path("audio"))

    async def test_invalid_worker_response_is_not_accepted(self):
        process = SimpleNamespace(returncode=0, communicate=AsyncMock(return_value=(b'{"text": 12}', b"")))
        with self.assertRaises(transcribe.HTTPException) as raised:
            await self.invoke_worker(process)
        self.assertEqual(raised.exception.status_code, 502)

    async def test_worker_timeout_terminates_inference(self):
        process = SimpleNamespace(returncode=None)
        process.communicate = AsyncMock(side_effect=[TimeoutError(), (b"", b"")])
        process.kill = lambda: setattr(process, "returncode", -9)
        with self.assertRaises(transcribe.HTTPException) as raised:
            await self.invoke_worker(process)
        self.assertEqual(raised.exception.status_code, 504)
        self.assertEqual(process.returncode, -9)

    async def test_cancelled_request_terminates_inference(self):
        process = SimpleNamespace(returncode=None)
        process.communicate = AsyncMock(side_effect=[asyncio.CancelledError(), (b"", b"")])
        process.kill = lambda: setattr(process, "returncode", -9)
        with self.assertRaises(asyncio.CancelledError):
            await self.invoke_worker(process)
        self.assertEqual(process.returncode, -9)

    async def test_missing_installation_is_actionable(self):
        with patch.object(Path, "is_file", return_value=False), self.assertRaises(transcribe.HTTPException) as raised:
            await transcribe.run_parakeet(Path("audio"))
        self.assertEqual(raised.exception.status_code, 503)
        self.assertIn("install-parakeet.py", raised.exception.detail)
