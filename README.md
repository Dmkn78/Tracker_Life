# Life Regime Tracker

Low-friction personal tracking MVP built with Next.js, React, TypeScript, Tailwind CSS, PostgreSQL, Prisma, and signed httpOnly cookie authentication.

## Local Setup

1. Copy `.env.example` to `.env`.
2. Set a long private `APP_ACCESS_KEY` and `AUTH_SECRET`.
3. Start PostgreSQL:

```powershell
docker compose up -d
```

4. Apply the schema:

```powershell
pnpm prisma:migrate --name init
```

5. Start the app:

```powershell
pnpm dev
```

## If Node.js/pnpm Are Not Installed Globally

This Codex workspace includes helper scripts that call the bundled Node.js runtime used while building the app:

```powershell
cd H:\CYTECHDATA\Documents\interface
.\scripts\prisma-migrate.ps1 -Name init
.\scripts\dev.ps1
```

If PowerShell blocks `.ps1` scripts on your machine, use the `.cmd` wrappers instead:

```powershell
cd H:\CYTECHDATA\Documents\interface
.\scripts\prisma-migrate.cmd init
.\scripts\dev.cmd
```

These scripts solve `pnpm : The term 'pnpm' is not recognized`. They do not install PostgreSQL; the database still needs to be running at the `DATABASE_URL` in `.env`.

## Whisper Service

Voice transcription is wired to a local FastAPI service.

```powershell
python -m pip install -r services/requirements.txt
.\scripts\start-whisper-service.cmd
```

The Next.js app calls `/api/transcribe`, which forwards the audio file to the Python service and returns the transcript into `DailyLog.voiceTranscript`.

When no `APP_ACCESS_KEY` is set, development uses `dev-access-key`. Do not use that fallback with real data.

## MVP Scope

- Home dashboard with date, main task, progress, next event, log status, and fast actions.
- Daily Log with sliders, yes/no training, optional text, voice transcript placeholder, sleep intent, local draft restore, and server autosave.
- To-do list with importance, productivity flag, completion buttons, and task status.
- Calendar context events with type, impact, stress, and preparation load.
- Rule-based execution, state, risk, risk delta, and risk acceleration scores.
- History and weekly JSON export at `/api/reports/week?week_id=YYYY-Www`.

## Prisma

The app uses PostgreSQL through Prisma. The main models are `User`, `DailyLog`, `Task`, `CalendarEvent`, and `WeeklyReport`.
