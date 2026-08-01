# Carte des dossiers et fichiers importants

Cette carte se concentre sur les fichiers qui définissent une frontière, un contrat ou un flux central. Les petits composants de présentation sont regroupés par feature lorsque leur rôle découle clairement de leur dossier.

## Racine et configuration

| Fichier | Rôle et contenu | Dépend de | Utilisé par | À ne pas casser |
| --- | --- | --- | --- | --- |
| `package.json` | Déclare stack Node, versions et scripts | registre pnpm | développeurs, build | noms des scripts utilisés par wrappers et documentation |
| `pnpm-lock.yaml` | Fige l’arbre exact des dépendances Node | `package.json` | `pnpm install` | ne pas l’éditer manuellement |
| `tsconfig.json` | Active TypeScript strict et alias `@/*` | TypeScript/Next | tous les `.ts/.tsx` | `strict`, `noEmit`, alias racine |
| `next.config.ts` | Configuration Next, limite Server Actions | Next.js | build et serveur | ne couvre pas les uploads des route handlers |
| `tailwind.config.ts` | Thème et chemins scannés | Tailwind | build CSS | conserver `features/**/*` dans `content` |
| `.env.example` | Liste la configuration sans secrets réels | code de config | nouveaux environnements | aucune vraie clé ; noms synchronisés avec le code |
| `docker-compose.yml` | PostgreSQL 16 local et volume | Docker | environnement local | le volume contient les données |
| `prisma/schema.prisma` | Source de vérité des tables, enums, relations et index | `DATABASE_URL` | Prisma Client, migrations, mapping Python | tout changement exige migration et alignement SQLAlchemy |
| `prisma/migrations/` | Historique SQL du schéma | schema Prisma | bases existantes | ne pas réécrire une migration déjà appliquée |

## Pages et routes Next.js

| Fichier ou groupe | Rôle et contenu | Dépend de | Utilisé par | À ne pas casser |
| --- | --- | --- | --- | --- |
| `app/layout.tsx` | Layout racine, métadonnées et styles globaux | React, `globals.css` | toutes les pages | structure HTML racine |
| `app/page.tsx` | Accueil SSR agrégé | auth, client interne, parser Life Terminal, UI partagée | route `/` | authentification et validation du read model |
| `app/life/page.tsx` | Vue trajectoire SSR | mêmes frontières Life Terminal, graphiques | `/life`, alias `/dashboard` | champs du résumé/terminal |
| `app/life-terminal/page.tsx` | Charge le read model puis monte le client complexe | auth, client interne, feature Life Terminal | `/life-terminal` et alias dashboard | ne pas appeler la DB directement |
| `app/history/page.tsx` | Historique filtré rendu serveur | feature History, dates, client interne | `/history` | encoder/normaliser le filtre avant l’appel |
| `app/<feature>/page.tsx` | Pages Daily Log, Todo, Calendar, Habits, Objectives, Time Allocation, Settings | auth, API/parser et composant de feature | routes utilisateur | page mince : auth + chargement + composition |
| `app/login/page.tsx` | Formulaire public de connexion | `features/auth/api/sessionApi.ts` | `/login` | ne pas exposer la clé ni lire le cookie côté client |
| `app/api/auth/login/route.ts` | Vérifie la clé et crée le cookie | `lib/auth.ts`, Prisma | formulaire de login | comparaison constante et cookie sécurisé |
| `app/api/auth/logout/route.ts` | Supprime le cookie | `lib/auth.ts` | bouton de déconnexion | nom/path du cookie |
| `app/api/{daily-log,tasks,calendar-events,habits,objectives,settings,time-allocation}/route.ts` | Proxies métier par méthodes autorisées | `proxyApiRequest` | modules API des features | aucune logique métier ni accès DB |
| `app/api/reports/week/route.ts` | Proxy de l’export hebdomadaire | `proxyApiRequest` | bouton d’export | conserver query et `Content-Disposition` |
| `app/api/transcribe/route.ts` | Proxy multipart vers FastAPI avec timeout audio dédié | `proxyApiRequest` | `lib/whisper.ts` | transmettre type, cookie et corps binaire ; timeout 185 s |

## Infrastructure frontend partagée

| Fichier | Rôle et contenu | Dépend de | Utilisé par | À ne pas casser |
| --- | --- | --- | --- | --- |
| `lib/http/apiClient.ts` | `requestJson`, `ApiError`, timeout, abort et validateurs JSON | Fetch API du navigateur | APIs de features et Whisper | réponse invalide ≠ réponse typée ; conserver `credentials` |
| `lib/server/proxyApiRequest.ts` | Construit l’URL FastAPI, transfère query/cookie/corps et normalise indisponibilité | `INTERNAL_API_URL`, Fetch serveur | routes proxy Next | ne jamais transmettre des en-têtes arbitraires ; défaut 30 s, option explicite pour l’audio |
| `lib/server/internalApiClient.ts` | Appel SSR direct avec cookies, no-store, timeout et parser | `next/headers`, `ApiError`, `INTERNAL_API_URL` | pages serveur | cookie et parseur obligatoires |
| `lib/auth.ts` | Signature/décodage HMAC, utilisateur local, cookie et gardes | `next/headers`, crypto, `lib/prisma.ts`, secrets | pages et routes auth | compatibilité exacte avec `security.py` |
| `lib/prisma.ts` | Singleton Prisma côté Next | Prisma Client, `DATABASE_URL` | `lib/auth.ts` | ne pas y réintroduire la logique métier |
| `lib/dates.ts` | Dates civiles et semaines ISO côté TypeScript | JavaScript Date | pages/features | éviter les décalages de jour/fuseau |
| `lib/whisper.ts` | Capture/upload côté frontend et lecture de `{text}` | client HTTP partagé | Daily Log | endpoint public `/api/transcribe`, validation réponse |
| `components/AppShell.tsx` | Navigation et structure visuelle commune | React/Next | pages métier | liens principaux et comportement responsive |
| `components/ui.tsx` | Primitives comme Panel, Metric et boutons | React/Tailwind | nombreux écrans | API de composants partagée |
| `components/TrajectoryCharts.tsx` | Graphiques de trajectoire | Recharts | accueil et Life | forme des points de trajectoire |
| `components/WeeklyExportButton.tsx` | Déclenche le rapport JSON | route report | History | gestion du téléchargement |

## Features frontend

| Dossier/fichier | Rôle et contenu | Dépend de | Utilisé par | À ne pas casser |
| --- | --- | --- | --- | --- |
| `features/auth/api/sessionApi.ts` | Appels login/logout et parsing minimal | `apiClient` | login, logout | ne jamais stocker la clé dans le navigateur |
| `features/todo/domain/todoTask.ts` | Types et règles des tâches | rien de framework | API et composants Todo | valeurs de statut/importance |
| `features/todo/api/todoApi.ts` | Liste/création/patch + parsers | domaine Todo, `apiClient` | `TodoClient` et page | forme `{task,tasks}` et dates |
| `features/todo/components/TodoClient.tsx` | État et commandes de la page | API/domain, `TodoList` | page `/todo` | rollback/erreurs et requêtes concurrentes |
| `features/todo/components/TodoList.tsx` | Rendu de liste | types/callbacks Todo | `TodoClient` | rester présentationnel |
| `features/daily-log/domain/dailyLog.ts` | Forme du journal, valeurs et statuts | aucun accès réseau | API/formulaire | bornes et nullabilité |
| `features/daily-log/api/dailyLogApi.ts` | Lecture, statuts de période, autosave/upsert et parsing | `apiClient`, domaine | page/formulaire/date picker | séparer statut mensuel et journal |
| `features/daily-log/components/DailyLogForm.tsx` | Saisie, brouillon, autosave, audio | API, domaine, Whisper | page Daily Log | éviter les autosaves perdus/concurrents |
| `features/calendar/*` | Contrat, API et client FullCalendar | FullCalendar, `apiClient` | page Calendar, terminal | dates ISO et mutation événements |
| `features/habits/*` | Tracker, check-ins et gestion habitudes | `apiClient`, domaine | page Habits | distinguer définition et check-in |
| `features/history/api/historyApi.ts` | Parse le read model History | validateurs JSON, domaine | page History | filtres et forme du résumé |
| `features/history/domain/history.ts` | Types et normalisation du filtre | fonctions pures | API/page | union `last7|last30|week|all` |
| `features/life-terminal/api/lifeTerminalApi.ts` | Parse le read model agrégé | validateurs JSON, domaine | accueil/Life/Terminal | validation de toutes les sous-structures |
| `features/life-terminal/components/LifeTerminalClient.tsx` | Orchestration du terminal | sous-composants et domaine | page Terminal | ne pas réabsorber tout le calendrier/panel |
| `features/life-terminal/components/CalendarCommandCenter.tsx` | Zone calendrier extraite | FullCalendar/domain | Terminal client | responsabilité calendrier uniquement |
| `features/objectives/api/objectivesApi.ts` | Commandes objectif/bloc et parsing | `apiClient`, domaines | client Objectives | `kind` commande et `weekId` |
| `features/objectives/components/ObjectivesClient.tsx` | État global de l’écran après découpage | composants spécialisés/API | page Objectives | garder éditeur, arbre, map et planning séparés |
| `features/objectives/components/Objective*.tsx`, `WeeklyBlockForm.tsx` | Sous-responsabilités UI explicites | domaine/callbacks | Objectives client | pas de `fetch` ou duplication des types |
| `features/settings/*` | Préférences et déconnexion | API auth/settings | page Settings | valeurs par défaut utilisateur |
| `features/time-allocation/*` | Portefeuille de temps, commandes et interface | `apiClient`, domaine | page Time Allocation | types de commande PATCH et arrondis |

## API Python

| Fichier ou dossier | Rôle et contenu | Dépend de | Utilisé par | À ne pas casser |
| --- | --- | --- | --- | --- |
| `interface_API/run.py` | Point d’entrée développement Uvicorn | `app.config` | scripts dev | host/port configurables |
| `interface_API/app/main.py` | Application, CORS, erreurs et inclusion des routeurs | config, tous les routers | Uvicorn/OpenAPI | forme `{error,details}` et liste complète des routers |
| `interface_API/app/config.py` | Charge `.env`, valide entiers/secrets et adapte URL Prisma | dotenv, environnement | main, DB, security, transcribe, run | production exige les secrets ; retirer `schema` pour psycopg2 |
| `interface_API/app/database.py` | Engine, `SessionLocal`, `Base`, transaction par requête | config, SQLAlchemy | routeurs et modèles | commit/rollback/close atomiques |
| `interface_API/app/security.py` | Cookie HMAC et utilisateur courant | config, database, models | routeurs | compatibilité avec `lib/auth.ts`, rejet sans exception des tokens malformés |
| `interface_API/app/ids.py` | Génération d’identifiants compatibles | bibliothèque standard | modèles/créations | compatibilité avec les ids existants |
| `interface_API/app/models.py` | Mapping SQLAlchemy du schéma Prisma | `database.Base`, ids, SQLAlchemy | routers et core | noms de tables/colonnes/enums identiques au schéma |
| `interface_API/app/contracts/common.py` | Base Pydantic avec alias camelCase | Pydantic | tous les contrats | politique `extra` et aliases publics |
| `interface_API/app/contracts/enums.py` | Enums insensibles à la casse | Enum/Pydantic | contrats | valeurs alignées Prisma/JSON |
| `interface_API/app/contracts/*.py` | Corps de requête, bornes et validation croisée | common/enums | routeurs correspondants | absent vs null, valeurs par défaut |
| `interface_API/app/routers/*.py` | Frontières HTTP, auth, ownership et orchestration | contrats, core, models, DB | `main.py` | route courte, filtre utilisateur, statuts stables |
| `interface_API/app/core/dates.py` | Dates, ISO weeks et UTC | bibliothèque standard | nombreux core/routers | sémantique commune avec `lib/dates.ts` |
| `interface_API/app/core/numbers.py` | Arrondi compatible JavaScript | `math` | métriques/allocation | cas `.5`, surtout négatif |
| `interface_API/app/core/metrics.py` | Scores, résumé, trajectoire et export de base | modèles, dates, nombres | reports/life/history/scoring | parité des formules |
| `interface_API/app/core/scoring.py` | Recalcul autour d’un journal modifié | métriques, régime, models | routes Daily Log/Tasks/Events | recalcul des jours voisins |
| `interface_API/app/core/history.py` | Read model History | metrics/models | router History | filtres autorisés et dates visibles |
| `interface_API/app/core/life_terminal.py` | Read model Terminal | plusieurs core/models | router Life Terminal | forme consommée par trois pages |
| autres `core/*.py` | Habits, objectifs, allocation, rapports, régime, Todo | modèles/utilitaires | routeurs/read models | aucune dépendance FastAPI/frontend |

## Services, scripts et tests

| Fichier | Rôle et contenu | Dépend de | Utilisé par | À ne pas casser |
| --- | --- | --- | --- | --- |
| `services/whisper_service.py` | Santé, upload borné, modèle lazy, sémaphore et nettoyage temporaire | Whisper, FastAPI, ffmpeg, dotenv | FastAPI `/api/transcribe` | limite, types, concurrence et suppression du fichier |
| `services/requirements.txt` | Dépendances du service audio | pip | installation Whisper | versions compatibles et `python-dotenv` |
| `interface_API/requirements.txt` | Dépendances exactes de l’API métier | pip | environnement API | éviter les mises à jour non testées |
| `scripts/dev.ps1` / `.cmd` | Orchestration locale Windows | services installés | développeur | ne pas masquer l’échec FastAPI |
| `scripts/test-api.ps1` / `.cmd` | Découverte des tests Python | interpréteur API | `pnpm test:api` | bon répertoire courant/PYTHONPATH |
| `interface_API/tests/test_contracts.py` | Contrats Pydantic | contracts | qualité API | cas limites lors d’un contrat modifié |
| `interface_API/tests/test_security.py` | Robustesse session | security | qualité sécurité | tokens malformés et format partagé |
| `interface_API/tests/test_numeric_parity.py` | Parité de calcul | core | qualité métriques | arrondis hérités |
| `interface_API/tests/test_api_boundaries.py` | Frontières HTTP publiques/privées | FastAPI TestClient | qualité API | health minimal et auth transcription |

## Comment utiliser cette carte

Pour modifier une feature, partez de sa ligne puis suivez les dépendances vers la droite et les consommateurs vers la gauche. Exemple pour une tâche : schéma Prisma → modèle SQLAlchemy → contrat/routeur → proxy → API Todo → composant. Si une couche du chemin n’a pas besoin du nouveau champ, notez explicitement pourquoi.
