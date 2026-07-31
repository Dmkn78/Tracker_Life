"""Life Regime Tracker API — standalone Python backend.

Replaces the backend logic embedded in the Next.js app (app/api/* + lib/*).
The frontend is meant to become a plain HTTP client of this API.
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .routers import (
    auth,
    calendar_events,
    daily_log,
    habits,
    life_terminal,
    objectives,
    reports,
    settings as settings_router,
    tasks,
    time_allocation,
    transcribe,
)

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


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return JSONResponse({"error": str(exc)}, status_code=500)


@app.get("/api/health")
def health():
    return {"ok": True, "usingDevAccessKey": get_settings().is_using_dev_access_key}


app.include_router(auth.router)
app.include_router(daily_log.router)
app.include_router(tasks.router)
app.include_router(calendar_events.router)
app.include_router(habits.router)
app.include_router(objectives.router)
app.include_router(settings_router.router)
app.include_router(time_allocation.router)
app.include_router(reports.router)
app.include_router(transcribe.router)
app.include_router(life_terminal.router)
