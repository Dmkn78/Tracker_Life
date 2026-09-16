"""Life Regime Tracker standalone API application."""

import logging
from importlib.util import find_spec

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .routers import (
    auth,
    calendar_events,
    companies,
    daily_log,
    emotional_reviews,
    habits,
    history,
    life_terminal,
    objectives,
    objective_planning,
    performance,
    reports,
    settings as settings_router,
    tags,
    tasks,
    thinking_notes,
    time_allocation,
)
from .models import User
from .security import get_current_user

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Life Regime Tracker API",
    version="0.1.0",
    description="Standalone backend API for the Life Regime Tracker frontend.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    validation_issues = [
        {
            "location": ".".join(str(part) for part in issue["loc"]),
            "message": issue["msg"],
            "type": issue["type"],
        }
        for issue in exc.errors()
    ]
    return JSONResponse(
        {"error": "Request validation failed", "details": validation_issues},
        status_code=422,
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse({"error": str(exc.detail)}, status_code=exc.status_code, headers=exc.headers)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled API error on %s", request.url.path, exc_info=exc)
    return JSONResponse({"error": "Internal server error"}, status_code=500)


@app.get("/api/health")
def health() -> dict[str, bool]:
    return {"ok": True, "usingDevAccessKey": get_settings().is_using_dev_access_key}


app.include_router(auth.router)
app.include_router(objective_planning.router)
app.include_router(daily_log.router)
app.include_router(emotional_reviews.router)
app.include_router(tasks.router)
app.include_router(calendar_events.router)
app.include_router(habits.router)
app.include_router(history.router)
app.include_router(objectives.router)
app.include_router(performance.router)
app.include_router(settings_router.router)
app.include_router(time_allocation.router)
app.include_router(reports.router)
if find_spec(f"{__package__}.routers.transcribe") is not None:
    from .routers import transcribe
    app.include_router(transcribe.router)
else:
    @app.post("/api/transcribe")
    def unavailable_transcription(user: User = Depends(get_current_user)):
        raise HTTPException(status_code=503, detail="Transcription module is not installed")
app.include_router(life_terminal.router)
app.include_router(companies.router)
app.include_router(tags.router)
app.include_router(thinking_notes.router)
