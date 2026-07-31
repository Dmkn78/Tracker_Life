import httpx
from fastapi import APIRouter, File, UploadFile
from fastapi.responses import JSONResponse

from ..config import get_settings

router = APIRouter(prefix="/api/transcribe", tags=["transcribe"])


@router.post("")
async def transcribe(file: UploadFile = File(...)):
    settings = get_settings()
    content = await file.read()
    files = {
        "file": (
            file.filename or "audio",
            content,
            file.content_type or "application/octet-stream",
        )
    }
    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            upstream = await client.post(settings.whisper_service_url, files=files)
    except httpx.HTTPError as error:
        return JSONResponse(
            {
                "error": (
                    "Whisper service is not running. Start it with "
                    "scripts/start-whisper-service.cmd or scripts/start-whisper-service.ps1."
                    if isinstance(error, httpx.ConnectError)
                    else f"Whisper service unavailable: {error}"
                )
            },
            status_code=503,
        )

    if upstream.status_code >= 400:
        try:
            body = upstream.json()
            message = body.get("detail") or body.get("error")
        except ValueError:
            message = upstream.text
        return JSONResponse({"error": message or "Transcription failed"}, status_code=502)

    data = upstream.json()
    return {"text": data.get("text") or ""}
