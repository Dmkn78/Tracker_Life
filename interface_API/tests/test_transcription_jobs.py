import asyncio
import json
from pathlib import Path
from types import SimpleNamespace
import tempfile
import time
import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
from app.main import app
from app.routers import transcribe, transcription_jobs
from app.security import get_current_user


class TranscriptionJobTests(unittest.TestCase):
    def setUp(self):
        app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id="voice-test")
        self.temporary = tempfile.TemporaryDirectory()
        self.root = patch.object(transcribe, "REPOSITORY_ROOT", Path(self.temporary.name))
        self.root.start()
        self.worker = patch.object(transcribe, "run_parakeet", new_callable=AsyncMock)
        self.mock_worker = self.worker.start()
        self.mock_worker.return_value = {"text": "Bonjour.", "model": "parakeet-tdt-0.6b-v3"}
        self.client = TestClient(app).__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.worker.stop()
        self.root.stop()
        self.temporary.cleanup()
        app.dependency_overrides.clear()

    def upload(self, content=b"recording", content_type="audio/webm"):
        return self.client.post("/api/transcription-jobs", files={"file": ("summary.webm", content, content_type)})

    def wait_until_finished(self, job_id):
        for _ in range(100):
            response = self.client.get(f"/api/transcription-jobs/{job_id}")
            if response.json()["state"] != "transcribing":
                return response.json()
            time.sleep(0.01)
        self.fail("Job did not finish")

    def test_upload_returns_job_and_completed_text_without_holding_request(self):
        async def inspect(path, progress_file):
            self.assertEqual(path.read_bytes(), b"recording")
            self.audio_path = path
            return {"text": "Bonjour.", "model": "parakeet-tdt-0.6b-v3"}
        self.mock_worker.side_effect = inspect
        response = self.upload()
        self.assertEqual(response.status_code, 202)
        result = self.wait_until_finished(response.json()["jobId"])
        self.assertEqual(result["text"], "Bonjour.")
        self.assertEqual(result["progress"], 100)
        self.assertFalse(self.audio_path.exists())
        self.assertFalse(transcribe.transcription_slot.locked())

    async def slow_worker(self, path, progress_file):
        self.audio_path = path
        progress_file.write_text(json.dumps({"progress": 42}))
        try:
            await asyncio.sleep(60)
        finally:
            self.worker_cancelled = True

    def test_progress_cancellation_releases_slot_and_removes_audio(self):
        self.mock_worker.side_effect = self.slow_worker
        job_id = self.upload().json()["jobId"]
        self.assertEqual(self.client.get(f"/api/transcription-jobs/{job_id}").json()["progress"], 42)
        self.assertEqual(self.upload().status_code, 429)
        response = self.client.delete(f"/api/transcription-jobs/{job_id}")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(self.worker_cancelled)
        self.assertFalse(self.audio_path.exists())
        self.assertFalse(transcribe.transcription_slot.locked())
        self.assertEqual(self.client.get(f"/api/transcription-jobs/{job_id}").status_code, 404)

    def test_another_user_cannot_read_or_cancel_a_job(self):
        self.mock_worker.side_effect = self.slow_worker
        job_id = self.upload().json()["jobId"]
        app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id="other-user")
        self.assertEqual(self.client.get(f"/api/transcription-jobs/{job_id}").status_code, 404)
        self.assertEqual(self.client.delete(f"/api/transcription-jobs/{job_id}").status_code, 404)
        self.assertTrue(transcribe.transcription_slot.locked())

    def test_invalid_uploads_release_capacity_and_never_start_inference(self):
        self.assertEqual(self.upload(b"").status_code, 422)
        self.assertEqual(self.upload(content_type="text/html").status_code, 415)
        with patch.object(transcription_jobs, "get_settings", return_value=SimpleNamespace(max_audio_bytes=3)):
            self.assertEqual(self.upload().status_code, 413)
        self.mock_worker.assert_not_awaited()
        self.assertFalse(transcribe.transcription_slot.locked())
        self.assertEqual(list((Path(self.temporary.name) / ".runtime/transcriptions").iterdir()), [])

    def test_expired_results_are_removed(self):
        job_id = self.upload().json()["jobId"]
        self.wait_until_finished(job_id)
        transcription_jobs.jobs[job_id].finished_at = time.monotonic() - 601
        self.assertEqual(self.client.get(f"/api/transcription-jobs/{job_id}").status_code, 404)

    def test_worker_failure_is_reported_and_releases_capacity(self):
        self.mock_worker.side_effect = transcribe.HTTPException(422, "Audio exceeds the 30 minute limit")
        job_id = self.upload().json()["jobId"]
        result = self.wait_until_finished(job_id)
        self.assertEqual(result["state"], "error")
        self.assertIn("30 minute", result["error"])
        self.assertFalse(transcribe.transcription_slot.locked())

    def test_abandoned_job_is_cancelled_and_frees_capacity(self):
        self.mock_worker.side_effect = self.slow_worker
        with patch.object(transcription_jobs, "JOB_POLL_TIMEOUT_SECONDS", 0.02), patch.object(transcription_jobs, "JOB_WATCH_INTERVAL_SECONDS", 0.01):
            job_id = self.upload().json()["jobId"]
            time.sleep(0.08)
            result = self.client.get(f"/api/transcription-jobs/{job_id}").json()
        self.assertEqual(result["state"], "error")
        self.assertIn("keep the journal open", result["error"])
        self.assertTrue(self.worker_cancelled)
        self.assertFalse(self.audio_path.exists())
        self.assertFalse(transcribe.transcription_slot.locked())

    def test_requires_authentication(self):
        app.dependency_overrides.clear()
        self.assertEqual(self.upload().status_code, 401)
        self.assertEqual(self.client.get("/api/transcription-jobs/missing").status_code, 401)
        self.assertEqual(self.client.delete("/api/transcription-jobs/missing").status_code, 401)


class JobCancellationTests(unittest.IsolatedAsyncioTestCase):
    async def test_completed_job_cleanup_is_not_cancelled(self):
        directory = tempfile.TemporaryDirectory()
        cleaned = asyncio.Event()
        async def cleanup():
            await asyncio.sleep(0.01)
            directory.cleanup()
            cleaned.set()
        job = transcription_jobs.TranscriptionJob(user_id="owner", directory=directory, state="done")
        job.task = asyncio.create_task(cleanup())
        transcription_jobs.request_cancellation(job)
        await job.task
        self.assertTrue(cleaned.is_set())

    async def test_cancellation_is_requested_only_once(self):
        directory = tempfile.TemporaryDirectory()
        job = transcription_jobs.TranscriptionJob(user_id="owner", directory=directory)
        job.task = asyncio.create_task(asyncio.sleep(60))
        transcription_jobs.request_cancellation(job)
        transcription_jobs.request_cancellation(job)
        self.assertEqual(job.task.cancelling(), 1)
        await asyncio.gather(job.task, return_exceptions=True)
        directory.cleanup()
