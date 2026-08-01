import asyncio
import logging
import os
import shutil
import tempfile
from functools import lru_cache
from pathlib import Path

import imageio_ffmpeg
import whisper
from dotenv import load_dotenv
from fastapi.concurrency import run_in_threadpool
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware


logger = logging.getLogger(__name__)
REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(REPOSITORY_ROOT / ".env")

ALLOWED_AUDIO_TYPES = {"application/octet-stream", "video/webm"}
transcription_slots = asyncio.Semaphore(1)


def read_positive_integer(name: str, default: int) -> int:
    raw_value = os.environ.get(name)
    if raw_value is None:
        return default
    try:
        parsed_value = int(raw_value)
    except ValueError as error:
        raise RuntimeError(f"{name} must be an integer") from error
    if parsed_value <= 0:
        raise RuntimeError(f"{name} must be greater than zero")
    return parsed_value


MAX_AUDIO_BYTES = read_positive_integer("MAX_AUDIO_BYTES", 25 * 1024 * 1024)


def is_supported_audio_type(content_type: str | None) -> bool:
    return bool(content_type and (content_type.startswith("audio/") or content_type in ALLOWED_AUDIO_TYPES))


def ensure_ffmpeg_on_path() -> None:
    ffmpeg_exe = Path(imageio_ffmpeg.get_ffmpeg_exe())
    ffmpeg_dir = ffmpeg_exe.parent
    if ffmpeg_exe.name.lower() != "ffmpeg.exe":
        ffmpeg_dir = REPOSITORY_ROOT / ".runtime" / "ffmpeg"
        ffmpeg_dir.mkdir(parents=True, exist_ok=True)
        ffmpeg_shim = ffmpeg_dir / "ffmpeg.exe"
        if not ffmpeg_shim.exists():
            shutil.copyfile(ffmpeg_exe, ffmpeg_shim)

    ffmpeg_dir_value = str(ffmpeg_dir)
    current_path = os.environ.get("PATH", "")
    if ffmpeg_dir_value not in current_path:
        os.environ["PATH"] = f"{ffmpeg_dir_value};{current_path}"


@lru_cache(maxsize=1)
def load_model():
    ensure_ffmpeg_on_path()
    model_name = os.environ.get("WHISPER_MODEL", "tiny")
    return whisper.load_model(model_name)


app = FastAPI(title="Life Regime Whisper Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:3000", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    if not is_supported_audio_type(file.content_type):
        raise HTTPException(status_code=415, detail="Unsupported audio type")

    content = await file.read(MAX_AUDIO_BYTES + 1)
    await file.close()
    if len(content) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio file is too large")

    ensure_ffmpeg_on_path()
    suffix = Path(file.filename or "audio").suffix or ".mp3"
    temp_path = None
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp:
        temp_path = Path(temp.name)
        temp.write(content)
        temp.flush()

    try:
        if transcription_slots.locked():
            raise HTTPException(status_code=429, detail="Transcription service is busy")
        async with transcription_slots:
            try:
                model = await run_in_threadpool(load_model)
                result = await run_in_threadpool(model.transcribe, str(temp_path))
            except RuntimeError as exc:
                raise HTTPException(status_code=422, detail="Audio could not be transcribed") from exc
            except Exception as exc:
                logger.exception("Whisper transcription failed", exc_info=exc)
                raise HTTPException(status_code=500, detail="Whisper transcription failed") from exc
        return {"text": (result.get("text") or "").strip(), "language": result.get("language")}
    finally:
        if temp_path is not None:
            try:
                temp_path.unlink(missing_ok=True)
            except OSError:
                pass
