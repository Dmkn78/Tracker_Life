# Life Regime Tracker — API Python (interface_API)

Backend Python indépendant du Life Regime Tracker. Il remplace progressivement la
logique backend intégrée au frontend Next.js (`app/api/*` + `lib/*`). À terme, le
frontend devient un simple client HTTP de cette API.

## Architecture

- **FastAPI** : serveur HTTP + validation + documentation OpenAPI automatique (`/docs`).
- **SQLAlchemy 2.0** : accès à la **même base PostgreSQL** que l'application existante.
  Le schéma reste géré par les migrations Prisma (`prisma/`) ; les modèles Python
  (`app/models.py`) se mappent sur les tables existantes (`User`, `DailyLog`, `Task`,
  `CalendarEvent`, `Objective`, …). Aucune migration de données n'est nécessaire :
  les deux backends peuvent coexister pendant la transition.
- **Sessions compatibles** : le cookie `life_regime_session` est signé en HMAC-SHA256
  avec le même `AUTH_SECRET` que le frontend Next.js — une session ouverte d'un côté
  est valide de l'autre.

```
interface_API/
├── run.py                  # point d'entrée dev (uvicorn --reload)
├── requirements.txt
├── .env.example
└── app/
    ├── main.py             # application FastAPI + CORS + routeurs
    ├── config.py           # variables d'environnement (.env local puis .env racine)
    ├── database.py         # engine/session SQLAlchemy
    ├── models.py           # mapping des tables Prisma existantes
    ├── security.py         # cookie de session HMAC + clé d'accès
    ├── ids.py              # génération d'ids compatibles cuid
    ├── core/               # logique métier (portée de lib/*.ts)
    │   ├── dates.py            # clés de date, semaines ISO       (lib/dates.ts)
    │   ├── todo_metrics.py     # métriques tâches + contexte cal. (lib/todoMetrics.ts)
    │   ├── metrics.py          # scores, résumé hebdo, export     (lib/metrics.ts)
    │   ├── regime.py           # détection de régime              (lib/regime.ts)
    │   ├── scoring.py          # recalcul des scores journaliers  (lib/scoring.ts)
    │   ├── habits.py           # tracker d'habitudes              (lib/habits.ts)
    │   ├── time_allocation.py  # portefeuille de temps            (lib/timeAllocation.ts)
    │   ├── objectives.py       # arbre d'objectifs + planning     (lib/objectives.ts)
    │   ├── reports.py          # rapport hebdomadaire             (lib/reports.ts)
    │   └── life_terminal.py    # dashboard Life Terminal          (lib/lifeTerminal.ts)
    └── routers/            # endpoints HTTP (mêmes chemins/JSON que app/api/*)
```

## Endpoints

Mêmes chemins et mêmes contrats JSON que les routes Next.js actuelles :

| Méthodes | Chemin | Équivalent Next.js |
| --- | --- | --- |
| POST | `/api/auth/login`, `/api/auth/logout` | `app/api/auth/*` |
| GET, POST | `/api/daily-log` | `app/api/daily-log` |
| GET, POST, PATCH | `/api/tasks` | `app/api/tasks` |
| GET, POST, PATCH, DELETE | `/api/calendar-events` | `app/api/calendar-events` |
| GET, POST, PATCH, DELETE | `/api/habits` | `app/api/habits` |
| GET, POST, PATCH, DELETE | `/api/objectives` | `app/api/objectives` |
| GET, PATCH | `/api/settings` | `app/api/settings` |
| GET, POST, PATCH, DELETE | `/api/time-allocation` | `app/api/time-allocation` |
| GET | `/api/reports/week?week_id=YYYY-Www` | `app/api/reports/week` |
| POST | `/api/transcribe` | `app/api/transcribe` (proxy Whisper) |
| GET | `/api/life-terminal?date=YYYY-MM-DD` | `lib/lifeTerminal.ts` (page serveur) |
| GET | `/api/health` | — |

Documentation interactive : `http://127.0.0.1:8000/docs`.

## Installation

```powershell
cd interface_API
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Configuration

```powershell
copy .env.example .env
```

Puis renseigner dans `.env` :

- `DATABASE_URL` : la même base PostgreSQL que l'app existante (le paramètre
  `?schema=public` de Prisma est accepté et ignoré). À défaut, le `.env` de la
  racine du dépôt est lu automatiquement.
- `APP_ACCESS_KEY` / `AUTH_SECRET` : **les mêmes valeurs** que le `.env` racine,
  pour que les sessions restent compatibles.
- `FRONTEND_ORIGINS` : origines autorisées par CORS (par défaut `localhost:3000`).

La base doit exister et être migrée par Prisma (comme aujourd'hui) :

```powershell
docker compose up -d          # à la racine du dépôt
pnpm prisma:migrate           # si le schéma n'est pas encore appliqué
```

## Lancement

```powershell
python run.py
# ou
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Le service Whisper reste inchangé (`services/whisper_service.py`, port 8001) ;
`POST /api/transcribe` lui relaie l'audio.

## Vérification rapide

```powershell
curl http://127.0.0.1:8000/api/health
curl -X POST http://127.0.0.1:8000/api/auth/login -H "Content-Type: application/json" -d '{"accessKey":"<APP_ACCESS_KEY>"}' -c cookies.txt
curl http://127.0.0.1:8000/api/daily-log -b cookies.txt
```

## Migration du frontend (étape suivante, hors périmètre actuel)

1. Pointer les appels `fetch("/api/...")` du frontend vers `http://127.0.0.1:8000/api/...`
   (ou configurer un proxy/rewrite Next.js vers l'API) avec `credentials: "include"`.
2. Remplacer les pages serveur qui appellent `lib/*` directement (ex. Life Terminal)
   par des appels à l'API (`/api/life-terminal`, `/api/objectives`, …).
3. Une fois toutes les pages migrées, supprimer `app/api/*` et la logique `lib/*`
   côté Next.js.
