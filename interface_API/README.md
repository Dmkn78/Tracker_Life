# API Python du Life Regime Tracker

Ce dossier contient le backend métier FastAPI. Il valide les requêtes avec Pydantic, utilise PostgreSQL avec SQLAlchemy et partage le cookie HMAC créé par Next.js.

La documentation détaillée est disponible dans :

- [`../docs/05-API-FASTAPI-HTTP.md`](../docs/05-API-FASTAPI-HTTP.md) pour les contrats HTTP ;
- [`../docs/06-BASE-DE-DONNEES.md`](../docs/06-BASE-DE-DONNEES.md) pour Prisma/PostgreSQL/SQLAlchemy ;
- [`../docs/07-CONFIGURATION-ET-SERVICES.md`](../docs/07-CONFIGURATION-ET-SERVICES.md) pour la configuration ;
- [`../docs/10-CARTE-DES-FICHIERS.md`](../docs/10-CARTE-DES-FICHIERS.md) pour les dépendances entre fichiers.

## Structure

```text
interface_API/
├── run.py
├── requirements.txt
├── .env.example
├── app/
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   ├── security.py
│   ├── ids.py
│   ├── models.py
│   ├── contracts/
│   ├── core/
│   └── routers/
└── tests/
```

Ce schéma signifie : `main.py` assemble l’application ; `routers/` gère HTTP ; `contracts/` valide les entrées ; `core/` contient les règles réutilisables ; `models.py` mappe les tables ; `database.py` gère les transactions.

## Installation

```powershell
Set-Location interface_API
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Le `.env` racine est chargé comme complément. `DATABASE_URL`, `APP_ACCESS_KEY` et `AUTH_SECRET` doivent correspondre aux valeurs de Next.js.

## Lancement

```powershell
python run.py
```

Ou directement :

```powershell
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Santé : `http://127.0.0.1:8000/api/health`.

Documentation OpenAPI : `http://127.0.0.1:8000/docs`.

## Endpoints

| Méthodes | Chemin | Rôle |
| --- | --- | --- |
| `GET` | `/api/health` | santé publique |
| `POST` | `/api/auth/login`, `/api/auth/logout` | session compatible |
| `GET` | `/api/daily-log/statuses` | statuts d’une plage de dates |
| `GET, POST` | `/api/daily-log` | lecture/upsert du journal |
| `GET, POST, PATCH` | `/api/tasks` | tâches |
| `GET, POST, PATCH, DELETE` | `/api/calendar-events` | calendrier |
| `GET, POST, PATCH, DELETE` | `/api/habits` | habitudes/check-ins |
| `GET, POST, PATCH, DELETE` | `/api/objectives` | objectifs et blocs hebdomadaires |
| `GET, PATCH` | `/api/settings` | préférences |
| `GET, POST, PATCH, DELETE` | `/api/time-allocation` | portefeuille de temps |
| `GET` | `/api/history` | historique agrégé |
| `GET` | `/api/reports/week` | export hebdomadaire |
| `GET` | `/api/life-terminal` | read model du terminal |
| `POST` | `/api/assistant/models` | découverte authentifiée des modèles LM Studio |
| `POST` | `/api/assistant/preview` | propositions de tâches ou analyse jour/7 jours, sans écriture |
| `POST` | `/api/transcribe` | relais authentifié vers Whisper |

Toutes les routes sauf health et login exigent normalement une session ; logout peut effacer un cookie sans session valide.

## Schéma et migrations

L’API ne crée pas ses tables. Prisma reste l’unique propriétaire du schéma sous `../prisma/`. Les classes de `app/models.py` doivent rester alignées manuellement.

Depuis la racine :

```powershell
pnpm prisma:generate
pnpm prisma:migrate --name nom_precis
```

## Tests

Depuis la racine :

```powershell
pnpm test:api
```

Ou depuis `interface_API` :

```powershell
python -m unittest discover -s tests -v
```

Les tests présents couvrent contrats, sécurité de session, parité numérique et quelques frontières HTTP. Ils ne couvrent pas encore une vraie base PostgreSQL.
