import os
import shutil
import tempfile
from functools import lru_cache
from pathlib import Path

import imageio_ffmpeg
import whisper
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware


def ensure_ffmpeg_on_path() -> None:
    ffmpeg_exe = Path(imageio_ffmpeg.get_ffmpeg_exe())
    ffmpeg_dir = ffmpeg_exe.parent
    if ffmpeg_exe.name.lower() != "ffmpeg.exe":
        ffmpeg_dir = Path(__file__).resolve().parents[1] / ".runtime" / "ffmpeg"
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
    ensure_ffmpeg_on_path()
    suffix = Path(file.filename or "audio").suffix or ".mp3"
    temp_path = None
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp:
        temp_path = Path(temp.name)
        temp.write(await file.read())
        temp.flush()

    try:
        model = load_model()
        try:
            result = model.transcribe(str(temp_path))
        except RuntimeError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Whisper transcription failed: {exc}") from exc
        return {"text": (result.get("text") or "").strip(), "language": result.get("language")}
    finally:
        if temp_path is not None:
            try:
                temp_path.unlink(missing_ok=True)
            except OSError:
                pass
