"""Short HTTP requests around a single bounded local transcription job."""
import asyncio
from dataclasses import dataclass, field
import json
from pathlib import Path
import tempfile
import time
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from ..config import get_settings
from ..models import User
from ..security import get_current_user
from . import transcribe

router = APIRouter(prefix="/api/transcription-jobs", tags=["transcription"])
MAX_JOB_SECONDS = 3600
RESULT_RETENTION_SECONDS = 600
UPLOAD_CHUNK_BYTES = 1024 * 1024
JOB_POLL_TIMEOUT_SECONDS = 180
JOB_WATCH_INTERVAL_SECONDS = 15


@dataclass
class TranscriptionJob:
    user_id: str
    directory: tempfile.TemporaryDirectory
    state: str = "transcribing"
    text: str = ""
    error: str = ""
    finished_at: float | None = None
    task: asyncio.Task | None = None
    last_poll: float = field(default_factory=time.monotonic)

    @property
    def progress_path(self) -> Path:
        return Path(self.directory.name) / "progress.json"


jobs: dict[str, TranscriptionJob] = {}


def prune_results() -> None:
    for job_id, job in list(jobs.items()):
        if job.finished_at is not None and time.monotonic() - job.finished_at > RESULT_RETENTION_SECONDS:
            del jobs[job_id]


async def finish_job(job: TranscriptionJob) -> None:
    worker = asyncio.create_task(transcribe.run_parakeet(
        Path(job.directory.name) / "audio", progress_file=job.progress_path,
    ))
    started = time.monotonic()
    try:
        while not worker.done():
            await asyncio.wait({worker}, timeout=JOB_WATCH_INTERVAL_SECONDS)
            if time.monotonic() - job.last_poll > JOB_POLL_TIMEOUT_SECONDS:
                raise HTTPException(status_code=408, detail="Transcription interrupted: keep the journal open while processing.")
            if time.monotonic() - started > MAX_JOB_SECONDS:
                raise TimeoutError()
        result = worker.result()
        job.text = result["text"]
        job.state = "done"
    except asyncio.CancelledError:
        job.state = "cancelled"
        raise
    except TimeoutError:
        job.state, job.error = "error", "Transcription timed out. Please try a shorter file."
    except HTTPException as error:
        job.state, job.error = "error", str(error.detail)
    except Exception:
        transcribe.logger.exception("Background transcription failed")
        job.state, job.error = "error", "Transcription failed. Please retry."
    finally:
        if not worker.done():
            worker.cancel()
        await asyncio.gather(worker, return_exceptions=True)
        job.finished_at = time.monotonic()
        try:
            job.directory.cleanup()
        finally:
            transcribe.transcription_slot.release()


def request_cancellation(job: TranscriptionJob) -> None:
    # Do not interrupt cleanup after completion, or cancel the same task twice.
    if job.state == "transcribing" and job.task and not job.task.done():
        job.state = "cancelled"
        job.task.cancel()


async def stop_jobs() -> None:
    tasks = [job.task for job in jobs.values() if job.task and not job.task.done()]
    for job in jobs.values():
        request_cancellation(job)
    await asyncio.gather(*tasks, return_exceptions=True)
    jobs.clear()


@router.post("", status_code=202)
async def create_job(file: UploadFile = File(...), user: User = Depends(get_current_user)) -> dict[str, str]:
    prune_results()
    directory = None
    acquired = False
    handed_off = False
    try:
        if not file.content_type or not (file.content_type.startswith("audio/") or file.content_type in {"video/webm", "application/octet-stream"}):
            raise HTTPException(status_code=415, detail="Unsupported audio type")
        if transcribe.transcription_slot.locked():
            raise HTTPException(status_code=429, detail="A transcription is already running. Please retry when it finishes.")
        await transcribe.transcription_slot.acquire()
        acquired = True
        runtime = transcribe.REPOSITORY_ROOT / ".runtime" / "transcriptions"
        runtime.mkdir(parents=True, exist_ok=True)
        directory = tempfile.TemporaryDirectory(prefix="job-", dir=runtime)
        size = 0
        size_limit = min(get_settings().max_audio_bytes, 100 * 1024 * 1024)
        with (Path(directory.name) / "audio").open("wb") as audio:
            while chunk := await file.read(UPLOAD_CHUNK_BYTES):
                size += len(chunk)
                if size > size_limit:
                    raise HTTPException(status_code=413, detail="Audio file is too large (100 MB maximum).")
                audio.write(chunk)
        if not size:
            raise HTTPException(status_code=422, detail="Audio file is empty")
        job_id = uuid4().hex
        job = TranscriptionJob(user_id=str(user.id), directory=directory)
        jobs[job_id] = job
        job.task = asyncio.create_task(finish_job(job))
        handed_off = True
        await asyncio.sleep(0)  # Start cleanup ownership before a client can cancel the job.
        return {"jobId": job_id}
    finally:
        await file.close()
        if not handed_off:
            try:
                if directory is not None:
                    directory.cleanup()
            finally:
                if acquired:
                    transcribe.transcription_slot.release()


def owned_job(job_id: str, user: User) -> TranscriptionJob:
    prune_results()
    job = jobs.get(job_id)
    if job is None or job.user_id != str(user.id):
        raise HTTPException(status_code=404, detail="Transcription no longer available. Please retry with your audio.")
    return job


@router.get("/{job_id}")
async def get_job(job_id: str, user: User = Depends(get_current_user)) -> dict:
    job = owned_job(job_id, user)
    job.last_poll = time.monotonic()
    progress = 100 if job.state == "done" else 0
    if job.state == "transcribing":
        try:
            progress = max(0, min(99, int(json.loads(job.progress_path.read_text())["progress"])))
        except (OSError, ValueError, KeyError):
            pass
    return {"state": job.state, "progress": progress, "text": job.text, "error": job.error}


@router.delete("/{job_id}")
async def cancel_job(job_id: str, user: User = Depends(get_current_user)) -> dict[str, bool]:
    job = owned_job(job_id, user)
    request_cancellation(job)
    if job.task:
        await asyncio.gather(job.task, return_exceptions=True)
    jobs.pop(job_id, None)
    return {"cancelled": True}
