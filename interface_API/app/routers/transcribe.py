"""Authenticated, bounded audio transcription using local Parakeet V3."""
import asyncio
import json
import logging
import os
import signal
from pathlib import Path
import tempfile

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from ..config import get_settings
from ..models import User
from ..security import get_current_user

router = APIRouter(prefix="/api", tags=["transcription"])
logger = logging.getLogger(__name__)
REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
MODEL_NAME = "sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8"
transcription_slot = asyncio.Semaphore(1)


@router.post("/transcribe")
async def transcribe(file: UploadFile = File(...), user: User = Depends(get_current_user)) -> dict[str, str]:
    settings = get_settings()
    try:
        if not file.content_type or not (file.content_type.startswith("audio/") or file.content_type in {"video/webm", "application/octet-stream"}):
            raise HTTPException(status_code=415, detail="Unsupported audio type")
        content = await file.read(settings.max_audio_bytes + 1)
    finally:
        await file.close()
    if not content:
        raise HTTPException(status_code=422, detail="Audio file is empty")
    if len(content) > settings.max_audio_bytes:
        raise HTTPException(status_code=413, detail="Audio file is too large")
    if transcription_slot.locked():
        raise HTTPException(status_code=429, detail="Transcription is busy. Please retry shortly.")
    async with transcription_slot:
        with tempfile.TemporaryDirectory(prefix="life-transcription-") as temporary_directory:
            audio_path = Path(temporary_directory) / "audio"
            audio_path.write_bytes(content)
            result = await run_parakeet(audio_path)
    return result


async def run_parakeet(audio_path: Path, progress_file: Path | None = None) -> dict[str, str]:
    runtime = REPOSITORY_ROOT / ".runtime"
    python_name = "Scripts/python.exe" if os.name == "nt" else "bin/python"
    python = Path(os.environ.get("PARAKEET_PYTHON", str(runtime / "parakeet-venv" / python_name)))
    model = Path(os.environ.get("PARAKEET_MODEL_DIR", str(runtime / "models" / MODEL_NAME)))
    required_files = ["encoder.int8.onnx", "decoder.int8.onnx", "joiner.int8.onnx", "tokens.txt"]
    if not python.is_file() or not all((model / name).is_file() for name in required_files):
        raise HTTPException(status_code=503, detail="Parakeet V3 is not installed. Run scripts/install-parakeet.py on the server.")
    try:
        process = await asyncio.create_subprocess_exec(
            str(python), str(REPOSITORY_ROOT / "services" / "parakeet_worker.py"), str(audio_path),
            env={**os.environ, "PARAKEET_MODEL_DIR": str(model), "OMP_NUM_THREADS": "2", **({"PARAKEET_PROGRESS_FILE": str(progress_file)} if progress_file else {})},
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
            start_new_session=os.name != "nt",
        )
    except OSError as error:
        raise HTTPException(status_code=503, detail="Parakeet V3 could not start") from error
    try:
        stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=3600 if progress_file else get_settings().whisper_timeout_seconds)
    except TimeoutError as error:
        raise HTTPException(status_code=504, detail="Transcription timed out. Try a shorter recording.") from error
    finally:
        if process.returncode is None:
            try:
                if os.name != "nt" and getattr(process, "pid", None):
                    os.killpg(process.pid, signal.SIGKILL)
                else:
                    process.kill()
            except ProcessLookupError:
                pass
            await process.communicate()
    if process.returncode == 2:
        raise HTTPException(status_code=422, detail="Audio is invalid or exceeds the 30 minute limit")
    if process.returncode != 0:
        logger.error("Parakeet worker exited with status %s", process.returncode)
        raise HTTPException(status_code=503, detail="Parakeet V3 transcription failed. Please retry.")
    try:
        result = json.loads(stdout)
        if not isinstance(result, dict) or not isinstance(result.get("text"), str):
            raise ValueError("Missing transcript")
    except (ValueError, UnicodeDecodeError) as error:
        raise HTTPException(status_code=502, detail="Invalid response from Parakeet V3") from error
    return {"text": result["text"], "model": "parakeet-tdt-0.6b-v3"}
