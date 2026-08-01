import httpx
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from ..config import get_settings
from ..models import User
from ..security import get_current_user

router = APIRouter(prefix="/api/transcribe", tags=["transcribe"])
ALLOWED_AUDIO_TYPES = {"application/octet-stream", "video/webm"}


def _is_supported_audio_type(content_type: str | None) -> bool:
    return bool(content_type and (content_type.startswith("audio/") or content_type in ALLOWED_AUDIO_TYPES))


@router.post("")
async def transcribe(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    settings = get_settings()
    if not _is_supported_audio_type(file.content_type):
        raise HTTPException(status_code=415, detail="Unsupported audio type")

    content = await file.read(settings.max_audio_bytes + 1)
    await file.close()
    if len(content) > settings.max_audio_bytes:
        raise HTTPException(status_code=413, detail="Audio file is too large")

    files = {
        "file": (
            file.filename or "audio",
            content,
            file.content_type or "application/octet-stream",
        )
    }
    try:
        timeout = httpx.Timeout(settings.whisper_timeout_seconds)
        async with httpx.AsyncClient(timeout=timeout) as client:
            upstream = await client.post(settings.whisper_service_url, files=files)
    except httpx.ConnectError as error:
        raise HTTPException(status_code=503, detail="Whisper service is unavailable") from error
    except httpx.HTTPError as error:
        raise HTTPException(status_code=503, detail="Whisper request failed") from error

    if upstream.status_code >= 400:
        try:
            body = upstream.json()
            message = body.get("detail") or body.get("error")
        except ValueError:
            message = upstream.text
        raise HTTPException(status_code=502, detail=message or "Transcription failed")

    try:
        data = upstream.json()
    except ValueError as error:
        raise HTTPException(status_code=502, detail="Whisper returned invalid JSON") from error
    return {"text": str(data.get("text") or "")}
