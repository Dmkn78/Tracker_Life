# Glossaire et index exhaustifs

## 1. Convention de lecture

Les chemins partent de la racine du dépôt. `L42` signifie « ligne 42 » dans l’état analysé. Les fonctions commençant par `_` sont internes par convention, mais restent indexées. Les éléments de « proposition » du chapitre 11 ne figurent pas ici : cet index décrit uniquement le code existant.

## 2. Glossaire alphabétique

### A

**Alias** — Autre nom d’un champ ou import. `ApiRequest` convertit les noms Python snake_case en noms JSON camelCase ; `settings as settings_router` évite une collision de nom.

**Annotation de type** — Information comme `name: str` ou `-> int`. Elle aide lecteurs et outils ; Pydantic l’utilise pour valider ses modèles.

**API** — Interface accessible ici par HTTP. L’API métier est l’objet `app` de `interface_API/app/main.py`.

**APIRouter** — Objet FastAPI regroupant routes, préfixe et tags. Chaque fichier de `app/routers/` expose `router`.

**Argument** — Valeur fournie lors d’un appel. Dans `add_days(date_key, 1)`, les deux expressions sont des arguments.

**ASGI** — Convention entre serveur et application asynchrone Python. Uvicorn sert l’objet FastAPI via ASGI.

**Asynchrone** — Exécution pouvant se suspendre sur une entrée/sortie avec `await`. Les deux routes de transcription sont asynchrones.

**Attribut** — Valeur attachée à un objet, comme `user.id` ou `body.status`.

**Authentification** — Vérification de l’identité. `get_current_user` valide le cookie signé.

### B

**Base64 URL-safe** — Encodage d’octets en texte compatible URL/cookie. Il ne chiffre pas les données.

**Base de données** — PostgreSQL, partagé avec le backend Next.js et géré structurellement par Prisma.

**BaseModel** — Classe Pydantic dont héritent les contrats HTTP.

**Bloc** — Groupe de lignes partageant une indentation après `if`, `def`, `class`, `try`, etc.

**Booléen** — `True` ou `False`. Attention : `False` est une vraie valeur métier, distincte de `None`.

**Body** — Corps d’une requête. FastAPI transforme le JSON en instance Pydantic `body`.

### C

**Callback** — Fonction fournie pour être appelée plus tard. Routes, validateurs, defaults ORM et gestionnaires d’erreur en sont des exemples.

**camelCase** — Convention JSON comme `completionPercent`, convertie depuis `completion_percent`.

**Classe** — Plan d’objets, déclaré avec `class`. Le projet a des classes de configuration, validation, enum, ORM et tests.

**Client HTTP** — Programme envoyant une requête. `httpx.AsyncClient` est le client du proxy Whisper ; `TestClient` est celui des tests.

**Cohérence transactionnelle** — Principe selon lequel toutes les écritures réussissent ensemble ou sont annulées ensemble.

**Commit** — Confirmation d’une transaction. `get_db` l’appelle après une route réussie.

**Compréhension** — Syntaxe compacte pour construire une collection, par exemple `[title for title in titles if title]`.

**Concurrence** — Progression de plusieurs travaux. Le sémaphore Whisper limite le travail lourd à une place.

**Condition** — Branche `if/elif/else` choisie selon une valeur booléenne.

**Configuration** — Valeurs de processus chargées dans `Settings`, distinctes des préférences utilisateur de `/api/settings`.

**Contrat** — Modèle Pydantic qui décrit et valide une entrée HTTP.

**Cookie** — Petite valeur transportée par HTTP. `life_regime_session` contient un payload signé et est `httpOnly`.

**CORS** — Politique du navigateur contrôlant les origines autorisées. `CORSMiddleware` l’applique.

**Coroutine** — Résultat d’un appel à `async def`, exécuté/attendu par la boucle événementielle.

**CRUD** — Create, Read, Update, Delete : créer, lire, modifier, supprimer.

### D

**Dataclass** — Classe de données dont le constructeur est généré. `Settings` est une dataclass gelée.

**Décorateur** — Syntaxe `@...` qui enregistre ou transforme une fonction/classe.

**Dépendance** — Fonction résolue par FastAPI grâce à `Depends`, notamment base et utilisateur.

**Dictionnaire** — Collection clé/valeur Python, souvent convertie en objet JSON.

**Docstring** — Chaîne au début d’un module/classe/fonction destinée à la documentation.

### E

**Effet de bord** — Modification extérieure au retour : écriture DB, cookie, fichier, log.

**Endpoint** — Couple méthode HTTP + chemin, lié à une fonction de route.

**Engine** — Moteur SQLAlchemy configurant accès et pool de connexions.

**Enum** — Ensemble fermé de valeurs. Les enums API acceptent la casse via `CaseInsensitiveEnum`.

**Event loop** — Boucle qui planifie les coroutines et reprend celles dont l’attente est terminée.

**Exception** — Objet signalant une interruption anormale ou une erreur attendue.

### F

**FastAPI** — Framework réel des deux applications Python du dépôt.

**Field** — Fonction Pydantic décrivant défauts et contraintes (`ge`, `le`, `min_length`).

**Flush** — Envoi des opérations SQL en attente sans confirmer la transaction.

**Fonction** — Bloc réutilisable défini avec `def` ou `async def`.

**Fonction imbriquée** — Fonction définie dans une fonction, comme `avg`, `collect`, `build_node`, `with_date_label` ou `previous_value`.

### G

**Générateur** — Fonction contenant `yield`. `get_db` encadre l’usage d’une session.

**Gestionnaire d’erreur** — Callback enregistré selon un type d’exception.

### H

**Header** — Métadonnée HTTP. CORS et les cookies s’appuient sur des headers.

**HMAC** — Signature avec secret utilisée pour détecter la falsification du cookie.

**HTTP** — Protocole requête/réponse entre frontend, API et microservice.

### I

**Identifiant** — Chaîne unique. `new_id` génère une valeur en forme de cuid.

**Import** — Instruction chargeant un module et rendant certains noms accessibles.

**Indentation** — Espaces qui délimitent les blocs Python.

**Injection de dépendances** — FastAPI construit les paramètres déclarés avec `Depends`.

**Instance** — Objet concret d’une classe, par exemple `Task(...)`.

### J

**JSON** — Format texte d’échange. Ses objets correspondent généralement aux dictionnaires Python.

**JSONB** — Type PostgreSQL binaire utilisé pour `WeeklyReport.content`.

### L

**Lambda/callback sélecteur** — Petite fonction passée à un helper pour choisir une valeur. Le core utilise des sélecteurs, même si tous ne sont pas écrits avec `lambda`.

**Liste** — Séquence ordonnée mutable Python.

**Literal** — Annotation limitant une chaîne à quelques valeurs exactes.

**Log** — Événement écrit côté serveur avec `logging`.

**lru_cache** — Décorateur mémorisant ici la configuration et le modèle Whisper.

### M

**Méthode** — Fonction attachée à une classe/instance.

**Middleware** — Couche exécutée autour des routes. Le projet ajoute CORS.

**Migration** — Évolution versionnée du schéma, gérée ici par Prisma.

**Modèle ORM** — Classe SQLAlchemy mappant une table/ligne.

**Module** — Fichier Python importable.

**Multipart** — Encodage HTTP utilisé pour téléverser le fichier audio.

**Mutation** — Modification d’un objet existant, comme `existing.title = ...`.

### N

**None** — Valeur Python représentant l’absence.

### O

**Objet** — Valeur possédant un type et éventuellement des attributs/méthodes.

**OpenAPI** — Description générée par FastAPI, visible avec Swagger UI sur `/docs`.

**ORM** — Object-Relational Mapper ; SQLAlchemy traduit objets/requêtes Python vers SQL.

### P

**Package** — Dossier de modules Python. Les fichiers `__init__.py` marquent les packages du projet.

**Paramètre** — Nom d’entrée dans une définition de fonction.

**PATH** — Variable d’environnement listant les dossiers d’exécutables ; Whisper y ajoute FFmpeg.

**Payload** — Données transportées, ici notamment le JSON signé de session.

**Pool de connexions** — Ensemble de connexions DB réutilisées par le moteur.

**Pool de threads** — Exécuteurs utilisés pour les appels Whisper bloquants.

**PostgreSQL** — SGBD réel attendu par l’API.

**Prisma** — Outil côté projet principal, propriétaire des migrations et du schéma.

**Propriété** — Méthode décorée `@property`, lue comme un attribut.

**Pydantic** — Bibliothèque de conversion et validation des contrats.

### Q

**Query string** — Partie après `?` dans l’URL ; `Query` déclare ses paramètres.

### R

**Raise** — Instruction qui lève une exception.

**Relation** — Lien logique par identifiant. Les modèles utilisent des ids texte sans déclarer ici de `relationship()` ORM.

**Requête SQL** — Expression `select`, `insert`, `update` ou suppression exécutée via la session.

**Réponse** — Statut, headers et corps renvoyés au client.

**Return** — Termine une fonction et rend une valeur.

**Rollback** — Annulation de la transaction sur exception.

**Route** — Fonction enregistrée pour une méthode et un chemin HTTP.

### S

**Schéma** — Selon le contexte : structure PostgreSQL/Prisma ou modèle de validation Pydantic.

**Sémaphore** — Compteur asynchrone limitant le nombre de tâches concurrentes.

**Sérialisation** — Conversion en représentation transportable, notamment dictionnaire puis JSON.

**Session SQLAlchemy** — Unité de travail et transaction pour les opérations ORM.

**snake_case** — Convention Python comme `completion_percent`.

**Statut HTTP** — Nombre décrivant le résultat : 200, 400, 401, etc.

**Synchronisation** — Exécution ordinaire `def` ; les routes DB utilisent une session synchrone.

### T

**Table** — Structure PostgreSQL mappée par `__tablename__`.

**Test d’intégration** — Test de plusieurs couches ; ceux avec `TestClient` couvrent la frontière HTTP mais pas une vraie DB ici.

**Test unitaire** — Test ciblant une unité, comme `javascript_round`.

**Thread** — Fil d’exécution. `run_in_threadpool` exécute Whisper hors de la boucle.

**Timeout** — Durée maximale d’attente HTTP définie par `WHISPER_TIMEOUT_SECONDS`.

**Transaction** — Groupe atomique d’opérations DB entre début et commit/rollback.

**Tuple** — Séquence fixe ; `encode_session` renvoie `(token, exp)`.

**Type MIME** — Description d’un contenu comme `audio/webm`.

### U

**UploadFile** — Abstraction FastAPI/Starlette pour un fichier multipart téléversé.

**URL** — Adresse d’un endpoint, composée notamment d’un schéma, hôte, port et chemin.

**UTC** — Référence de temps utilisée par les conversions de dates-heures.

**Uvicorn** — Serveur ASGI lancé par `run.py`.

### V

**Validation** — Conversion et contrôle d’une entrée avant la logique de route.

**Variable d’environnement** — Configuration de processus lue via `os.environ` et `.env`.

### Y

**Yield** — Produit une valeur puis suspend le générateur ; permet à `get_db` de reprendre après la route.

## 3. Index de tous les fichiers Python applicatifs et de test

| Fichier | Rôle réel |
| --- | --- |
| `interface_API/run.py` | point d’entrée de développement Uvicorn |
| `interface_API/app/__init__.py` | marque le package, vide |
| `interface_API/app/main.py` | construit l’API métier, CORS, erreurs, health, inclut les routeurs |
| `interface_API/app/config.py` | charge/valide l’environnement dans `Settings` |
| `interface_API/app/database.py` | moteur, fabrique de sessions, transaction `get_db` |
| `interface_API/app/security.py` | cookie HMAC, login logique, utilisateur courant |
| `interface_API/app/ids.py` | identifiant textuel en forme de cuid |
| `interface_API/app/models.py` | 13 mappings SQLAlchemy des tables Prisma |
| `interface_API/app/contracts/__init__.py` | package contrats, vide |
| `interface_API/app/contracts/common.py` | base Pydantic et alias camelCase |
| `interface_API/app/contracts/enums.py` | enums API insensibles à la casse |
| `interface_API/app/contracts/daily_log.py` | corps d’upsert journal |
| `interface_API/app/contracts/tasks.py` | corps création/mise à jour tâches |
| `interface_API/app/contracts/calendar_events.py` | corps calendrier et ordre temporel |
| `interface_API/app/contracts/habits.py` | corps habitudes/check-ins et cible conditionnelle |
| `interface_API/app/contracts/objectives.py` | corps objectifs/blocs/commandes |
| `interface_API/app/contracts/settings.py` | préférences calories/sommeil |
| `interface_API/app/contracts/time_allocation.py` | catégories, allocations, budget, portefeuille |
| `interface_API/app/core/__init__.py` | package core, vide |
| `interface_API/app/core/dates.py` | conversion, semaine ISO et libellés temporels |
| `interface_API/app/core/numbers.py` | arrondi compatible JavaScript |
| `interface_API/app/core/habits.py` | lecture tracker et upsert check-in |
| `interface_API/app/core/history.py` | historique et résumé selon filtre |
| `interface_API/app/core/life_terminal.py` | agrégat terminal de vie et sous-vues |
| `interface_API/app/core/metrics.py` | scores, résumé, trajectoire, export |
| `interface_API/app/core/objectives.py` | arbre objectifs, planning, démo, sérialisation |
| `interface_API/app/core/regime.py` | classification, transitions, simulation |
| `interface_API/app/core/reports.py` | génération/cache du rapport hebdomadaire |
| `interface_API/app/core/scoring.py` | orchestration et persistance des scores |
| `interface_API/app/core/time_allocation.py` | répartition, portefeuille, upserts |
| `interface_API/app/core/todo_metrics.py` | métriques tâches et pression calendrier |
| `interface_API/app/routers/__init__.py` | package routeurs, vide |
| `interface_API/app/routers/auth.py` | login/logout |
| `interface_API/app/routers/calendar_events.py` | CRUD événements |
| `interface_API/app/routers/daily_log.py` | statuts, lecture et upsert journal |
| `interface_API/app/routers/habits.py` | CRUD habitudes et check-ins |
| `interface_API/app/routers/history.py` | historique filtré |
| `interface_API/app/routers/life_terminal.py` | read model terminal |
| `interface_API/app/routers/objectives.py` | CRUD objectifs/blocs et bootstrap |
| `interface_API/app/routers/reports.py` | rapport hebdomadaire JSON téléchargeable |
| `interface_API/app/routers/settings.py` | lecture/mise à jour préférences utilisateur |
| `interface_API/app/routers/tasks.py` | liste/création/mise à jour tâches |
| `interface_API/app/routers/time_allocation.py` | CRUD et commandes d’allocation |
| `interface_API/app/routers/transcribe.py` | proxy audio authentifié vers Whisper |
| `interface_API/tests/__init__.py` | marque le package de tests |
| `interface_API/tests/test_api_boundaries.py` | health public et auth transcription |
| `interface_API/tests/test_contracts.py` | validation/normalisation des contrats |
| `interface_API/tests/test_numeric_parity.py` | parité d’arrondi et score |
| `interface_API/tests/test_security.py` | session valide et jetons malformés |
| `services/__init__.py` | package services, vide |
| `services/whisper_service.py` | seconde app FastAPI, modèle Whisper/FFmpeg |
| `scripts/course_timer.py` | outil CLI auxiliaire de compte à rebours ; hors API, sans route ni base |

Les fichiers sous `interface_API/.venv/` sont des dépendances installées et ne font pas partie du code source analysé.

## 4. Index de toutes les classes

### Configuration et base

| Classe | Fichier:ligne | Rôle |
| --- | --- | --- |
| `Settings` | `app/config.py:L52` | dataclass immuable de configuration |
| `Base` | `app/database.py:L17` | base déclarative SQLAlchemy |

### Contrats Pydantic

| Classe | Fichier:ligne |
| --- | --- |
| `ApiRequest` | `contracts/common.py:L9` |
| `DailyLogUpsertRequest` | `contracts/daily_log.py:L14` |
| `TaskCreateRequest` | `contracts/tasks.py:L13` |
| `TaskUpdateRequest` | `contracts/tasks.py:L25` |
| `CalendarEventCreateRequest` | `contracts/calendar_events.py:L14` |
| `CalendarEventUpdateRequest` | `contracts/calendar_events.py:L30` |
| `HabitCreateRequest` | `contracts/habits.py:L13` |
| `HabitUpdateRequest` | `contracts/habits.py:L22` |
| `ObjectiveCreateRequest` | `contracts/objectives.py:L22` |
| `ObjectiveUpdateRequest` | `contracts/objectives.py:L52` |
| `SettingsUpdateRequest` | `contracts/settings.py:L10` |
| `TimeAllocationCategoryCreateRequest` | `contracts/time_allocation.py:L13` |
| `TimeAllocationUpdateRequest` | `contracts/time_allocation.py:L23` |
| `LoginBody` | `routers/auth.py:L12` |

### Enums

| Classe | Fichier:ligne | Valeurs |
| --- | --- | --- |
| `CaseInsensitiveEnum` | `contracts/enums.py:L8` | base et `_missing_` |
| `DailyLogStatus` | `enums.py:L21` | EMPTY, DRAFT, SUBMITTED, ANALYZED, MISSING, SKIPPED |
| `TaskImportance` | `enums.py:L30` | LOW, MEDIUM, HIGH |
| `TaskStatus` | `enums.py:L36` | PLANNED, IN_PROGRESS, DONE, POSTPONED, CANCELLED |
| `CalendarEventType` | `enums.py:L44` | EXAM, INTERVIEW, DEADLINE, ADMIN, SOCIAL, TRAINING, RECOVERY, TRAVEL, PERSONAL |
| `CalendarImpact` | `enums.py:L56` | LOW, MEDIUM, HIGH, CRITICAL |
| `ObjectiveKind` | `enums.py:L63` | OBJECTIVE, PROJECT, MILESTONE |
| `ObjectiveHorizon` | `enums.py:L69` | YEAR, QUARTER, MONTH, WEEK |
| `ObjectiveStatus` | `enums.py:L76` | PLANNED, ACTIVE, ON_TRACK, AT_RISK, PAUSED, DONE |
| `ObjectivePriority` | `enums.py:L85` | LOW, MEDIUM, HIGH, CRITICAL |
| `WeeklyPlanCategory` | `enums.py:L92` | WORK, STUDY, SPORT, REST, ADMIN, PERSONAL, SOCIAL, TRAVEL |

### Modèles ORM

| Classe | Table | Fichier:ligne |
| --- | --- | --- |
| `User` | `User` | `models.py:L41` |
| `DailyLog` | `DailyLog` | `models.py:L52` |
| `Task` | `Task` | `models.py:L90` |
| `TimeAllocationCategory` | `TimeAllocationCategory` | `models.py:L107` |
| `DailyTimeAllocation` | `DailyTimeAllocation` | `models.py:L124` |
| `DailyPlanningContext` | `DailyPlanningContext` | `models.py:L139` |
| `Habit` | `Habit` | `models.py:L150` |
| `HabitCheckin` | `HabitCheckin` | `models.py:L167` |
| `RoutineBlock` | `RoutineBlock` | `models.py:L181` |
| `CalendarEvent` | `CalendarEvent` | `models.py:L197` |
| `WeeklyReport` | `WeeklyReport` | `models.py:L213` |
| `Objective` | `Objective` | `models.py:L224` |
| `WeeklyPlanBlock` | `WeeklyPlanBlock` | `models.py:L246` |

### Tests

| Classe | Fichier:ligne |
| --- | --- |
| `ApiBoundaryTests` | `tests/test_api_boundaries.py:L10` |
| `RequestContractTests` | `tests/test_contracts.py:L16` |
| `NumericParityTests` | `tests/test_numeric_parity.py:L10` |
| `SessionSecurityTests` | `tests/test_security.py:L8` |

## 5. Index de toutes les fonctions applicatives

### `config.py`, `database.py`, `ids.py`, `security.py`, `main.py`

| Fonction | Fichier:ligne | Rôle/appel principal |
| --- | --- | --- |
| `_sqlalchemy_url` | `config.py:L26` | adapte URL Prisma pour SQLAlchemy |
| `_read_positive_integer` | `config.py:L38` | valide entier d’environnement |
| `Settings.signing_secret` | `config.py:L65` | propriété de secret effectif |
| `Settings.access_key` | `config.py:L69` | propriété de clé effective |
| `Settings.is_using_dev_access_key` | `config.py:L73` | indique fallback développement |
| `get_settings` | `config.py:L78` | construit configuration, cachée |
| `get_db` | `database.py:L21` | générateur transactionnel FastAPI |
| `_base36` | `ids.py:L11` | encode entier en base 36 |
| `new_id` | `ids.py:L19` | génère identifiant ; callback ORM |
| `_enum` | `models.py:L33` | construit un type ENUM PostgreSQL sans le créer |
| `utcnow` | `models.py:L37` | callback de date UTC naïve pour SQLAlchemy |
| `_b64url_encode` | `security.py:L29` | octets vers texte Base64URL |
| `_b64url_decode` | `security.py:L33` | Base64URL vers octets |
| `_sign` | `security.py:L38` | signature HMAC-SHA256 |
| `encode_session` | `security.py:L43` | fabrique token + expiration |
| `decode_session` | `security.py:L52` | valide token et renvoie user id/None |
| `set_session_cookie` | `security.py:L80` | écrit cookie sécurisé |
| `clear_session_cookie` | `security.py:L93` | supprime cookie |
| `ensure_local_user` | `security.py:L97` | trouve ou crée utilisateur local |
| `authenticate_access_key` | `security.py:L107` | compare clé et renvoie utilisateur |
| `get_current_user` | `security.py:L114` | dépendance d’authentification |
| `validation_exception_handler` | `main.py:L44` | callback 422 |
| `http_exception_handler` | `main.py:L63` | callback HTTPException |
| `unhandled_exception_handler` | `main.py:L68` | callback 500 avec log |
| `health` | `main.py:L74` | santé API métier |

### Outil auxiliaire `scripts/course_timer.py`

| Fonction | Ligne | Rôle |
| --- | --- | --- |
| `format_remaining_time` | L12 | transforme un entier de secondes en `MM:SS` |
| `run_countdown` | L18 | boucle jusqu’à l’échéance monotone et affiche le temps |
| `parse_arguments` | L33 | déclare/lit l’option CLI `--seconds` |
| `main` | L45 | orchestre parsing, minuterie et erreurs utilisateur |

Ce script n’est importé ni par `interface_API` ni par `services`. Le garde `if __name__ == "__main__"` appelle `main()` uniquement lors de son exécution directe. Il n’ajoute aucun endpoint et ne participe à aucune transaction.

### Méthodes de configuration et de validation

| Méthode | Fichier:ligne | Déclenchement |
| --- | --- | --- |
| `Settings.signing_secret` | `config.py:L65` | accès à la propriété `settings.signing_secret` |
| `Settings.access_key` | `config.py:L69` | accès à la propriété `settings.access_key` |
| `Settings.is_using_dev_access_key` | `config.py:L73` | accès à la propriété correspondante |
| `CaseInsensitiveEnum._missing_` | `contracts/enums.py:L10` | callback Enum lorsqu’une valeur exacte manque |
| `CalendarEventCreateRequest.validate_time_range` | `contracts/calendar_events.py:L24` | Pydantic après validation des champs |
| `CalendarEventUpdateRequest.validate_time_range` | `contracts/calendar_events.py:L41` | Pydantic après validation des champs PATCH |
| `HabitUpdateRequest.validate_target` | `contracts/habits.py:L39` | Pydantic selon `kind` |
| `ObjectiveCreateRequest.validate_weekly_block` | `contracts/objectives.py:L46` | Pydantic pour commande `weekly_block` |
| `TimeAllocationUpdateRequest.validate_target` | `contracts/time_allocation.py:L43` | Pydantic selon `kind` |

### `core/dates.py` et `core/numbers.py`

| Fonction | Ligne | Rôle |
| --- | --- | --- |
| `to_date_key` | `dates.py:L16` | date/aujourd’hui vers ISO jour |
| `parse_date_key` | `dates.py:L20` | texte ISO vers `date` |
| `add_days` | `dates.py:L24` | décaler un jour |
| `get_iso_week_id` | `dates.py:L28` | id semaine ISO |
| `get_week_date_keys` | `dates.py:L34` | sept jours d’une semaine |
| `shift_week_id` | `dates.py:L40` | décaler une semaine |
| `day_label` | `dates.py:L44` | libellé court jour |
| `day_full_label` | `dates.py:L48` | libellé complet jour |
| `month_year_label` | `dates.py:L53` | libellé mois/année |
| `event_time_label` | `dates.py:L58` | libellé heure événement |
| `iso_datetime` | `dates.py:L64` | datetime optionnel vers ISO |
| `parse_iso_datetime` | `dates.py:L71` | texte vers datetime |
| `to_utc_naive` | `dates.py:L77` | normalise UTC sans tzinfo |
| `javascript_round` | `numbers.py:L8` | arrondi compatible JS |

### `core/habits.py`, `history.py`, `reports.py`

| Fonction | Fichier:ligne | Rôle |
| --- | --- | --- |
| `get_habit_tracker_data` | `habits.py:L14` | agrège tracker |
| `habit_payload` | `habits.py:L57` | sérialise habitude |
| `upsert_habit_checkin` | `habits.py:L110` | upsert PostgreSQL check-in |
| `get_history_data` | `history.py:L15` | historique filtré + résumé |
| `serialize_history_log` | `history.py:L43` | sérialise log historique |
| `generate_weekly_report` | `reports.py:L13` | produit/met en cache rapport |

### `core/todo_metrics.py`

| Fonction | Ligne | Rôle |
| --- | --- | --- |
| `calculate_todo_metrics` | L19 | calcule métriques d’une liste de tâches |
| `get_todo_metrics` | L45 | charge tâches et calcule métriques |
| `detect_active_phase_for_week` | L56 | classe la phase selon événements |
| `count_high_impact_events` | L69 | compte impacts élevés |
| `weekly_expected_load` | L73 | agrège stress/préparation |
| `get_next_high_impact_event` | L83 | prochain événement important |
| `_events_between` | L99 | sélection calendrier dans intervalle |
| `get_calendar_context` | L118 | compose contexte calendrier |

### `core/metrics.py`

| Fonction | Ligne | Rôle |
| --- | --- | --- |
| `clamp_score` | L19 | borne/arrondit score |
| `clamp_count` | L23 | borne compteur |
| `weighted_average` | L27 | moyenne pondérée ignorant `None` |
| `compute_state_score` | L35 | score état |
| `compute_execution_score` | L48 | score exécution |
| `compute_risk_score` | L59 | score risque |
| `compute_risk_delta` | L114 | variation risque |
| `compute_risk_acceleration` | L118 | variation de variation |
| `compute_weekly_summary` | L122 | agrégat hebdomadaire |
| `avg` | L134, imbriquée | moyenne locale |
| `collect` | L137, imbriquée | collecte par callback sélecteur |
| `build_interpretation_messages` | L164 | messages d’interprétation |
| `get_trajectory` | L198 | série temporelle |
| `build_weekly_json_export` | L233 | export JSON complet |
| `serialize_calendar_event` | L327 | événement vers dict/None |

### `core/scoring.py` et `core/regime.py`

| Fonction | Fichier:ligne | Rôle |
| --- | --- | --- |
| `_log_as_regime_dict` | `scoring.py:L24` | adapte log pour régime |
| `recompute_daily_scores` | `scoring.py:L43` | recalcule/persiste un jour |
| `recompute_around_date` | `scoring.py:L131` | recalcule autour d’un changement |
| `serialize_daily_log` | `scoring.py:L144` | sérialise log |
| `_clamp` | `regime.py:L13` | borne score |
| `_status` | `regime.py:L17` | statut d’un log optionnel |
| `_normalize_regime` | `regime.py:L21` | normalise libellé régime |
| `risk_level` | `regime.py:L25` | bande de risque |
| `compute_regime` | `regime.py:L36` | détermine régime/confiance |
| `compute_regime_transition` | `regime.py:L141` | probabilité/poids de transition |
| `simulate_next_week` | `regime.py:L155` | scénarios semaine suivante |
| `build_transition_matrix_placeholder` | `regime.py:L168` | matrice approximative explicite |

### `core/time_allocation.py`

| Fonction | Ligne | Rôle |
| --- | --- | --- |
| `_clamp` | L16 | borne valeur |
| `_clamp_minutes` | L20 | borne minutes |
| `allocate_minutes_from_weights` | L24 | répartition entière d’un budget |
| `compute_portfolio_metrics` | L48 | rendement/risque/bêta agrégés |
| `get_time_allocation_data` | L69 | compose vue temps |
| `upsert_daily_allocation` | L175 | upsert d’une allocation |
| `upsert_day_budget` | L217 | upsert budget du jour |

### `core/objectives.py`

| Fonction | Ligne | Rôle |
| --- | --- | --- |
| `format_minutes` | L28 | durée lisible |
| `serialize_objective` | L38 | objectif vers dictionnaire |
| `serialize_task` | L59 | tâche pour vue objectifs |
| `serialize_block` | L73 | bloc hebdomadaire sérialisé |
| `serialize_event` | L92 | événement pour planning |
| `default_objective_title` | L104 | titre par défaut selon kind |
| `sync_objective_tasks` | L113 | synchronise liaisons de tâches |
| `_objective_sort_key` | L128 | clé de tri hiérarchique |
| `get_objectives_data` | L136 | compose arbre/planning/statistiques |
| `build_node` | L215, imbriquée | construit récursivement un nœud sans cycle |
| `with_date_label` | L351, imbriquée | enrichit jour d’un libellé |
| `bootstrap_objectives_demo` | L419 | insère démonstration complète |

### `core/life_terminal.py`

| Fonction | Ligne | Rôle |
| --- | --- | --- |
| `_serialize_task` | L33 | tâche pour terminal |
| `_pressure_for_events` | L48 | pression calendrier |
| `_risk_band` | L59 | bande texte risque |
| `_trend` | L70 | direction de variation |
| `_data_quality_status` | L76 | qualité des données |
| `_build_weekly_planner` | L84 | planning de semaine |
| `_build_life_tape` | L129 | bande chronologique |
| `previous_value` | L145, imbriquée | valeur antérieure via callback |
| `_events_between` | L159 | événements d’intervalle |
| `_tasks_between` | L173 | tâches d’intervalle |
| `get_life_terminal_data` | L187 | orchestre read model complet |

## 6. Index de toutes les fonctions de route

| Fonction | Fichier:ligne | Méthode et URL |
| --- | --- | --- |
| `health` | `main.py:L74` | `GET /api/health` |
| `login` | `routers/auth.py:L17` | `POST /api/auth/login` |
| `logout` | `routers/auth.py:L27` | `POST /api/auth/logout` |
| `get_daily_log_statuses` | `daily_log.py:L22` | `GET /api/daily-log/statuses` |
| `get_daily_log` | `daily_log.py:L47` | `GET /api/daily-log` |
| `upsert_daily_log` | `daily_log.py:L66` | `POST /api/daily-log` |
| `list_tasks` | `tasks.py:L57` | `GET /api/tasks` |
| `create_tasks` | `tasks.py:L88` | `POST /api/tasks` |
| `update_task` | `tasks.py:L123` | `PATCH /api/tasks` |
| `list_events` | `calendar_events.py:L36` | `GET /api/calendar-events` |
| `create_event` | `calendar_events.py:L57` | `POST /api/calendar-events` |
| `update_event` | `calendar_events.py:L81` | `PATCH /api/calendar-events` |
| `delete_event` | `calendar_events.py:L116` | `DELETE /api/calendar-events` |
| `get_habits` | `habits.py:L33` | `GET /api/habits` |
| `create_habit` | `habits.py:L42` | `POST /api/habits` |
| `update_habit` | `habits.py:L63` | `PATCH /api/habits` |
| `delete_habit` | `habits.py:L110` | `DELETE /api/habits` |
| `get_history` | `history.py:L15` | `GET /api/history` |
| `life_terminal` | `life_terminal.py:L14` | `GET /api/life-terminal` |
| `get_objectives` | `objectives.py:L77` | `GET /api/objectives` |
| `create_objective` | `objectives.py:L86` | `POST /api/objectives` |
| `update_objective` | `objectives.py:L145` | `PATCH /api/objectives` |
| `delete_objective` | `objectives.py:L231` | `DELETE /api/objectives` |
| `weekly_report` | `reports.py:L15` | `GET /api/reports/week` |
| `get_settings_route` | `settings.py:L23` | `GET /api/settings` |
| `update_settings` | `settings.py:L28` | `PATCH /api/settings` |
| `get_time_allocation` | `time_allocation.py:L62` | `GET /api/time-allocation` |
| `create_category` | `time_allocation.py:L71` | `POST /api/time-allocation` |
| `update_time_allocation` | `time_allocation.py:L92` | `PATCH /api/time-allocation` |
| `delete_category` | `time_allocation.py:L181` | `DELETE /api/time-allocation` |
| `transcribe` | `routers/transcribe.py:L17` | `POST /api/transcribe` |
| `health` | `services/whisper_service.py:L80` | `GET /health` du microservice |
| `transcribe` | `services/whisper_service.py:L85` | `POST /transcribe` du microservice |

## 7. Index des helpers de route non exposés directement

| Fonction | Fichier:ligne | Rôle |
| --- | --- | --- |
| `serialize_event` | `routers/calendar_events.py:L17` | réponse calendrier |
| `serialize_habit` | `routers/habits.py:L15` | réponse habitude |
| `_validate_objective_parent` | `routers/objectives.py:L21` | appartenance et cycles |
| `_validate_block_objective` | `routers/objectives.py:L48` | objectif d’un bloc |
| `_normalize_week_id` | `routers/objectives.py:L66` | semaine selon commande |
| `_settings_payload` | `routers/settings.py:L12` | préférences utilisateur |
| `_validate_objective_access` | `routers/tasks.py:L15` | objectif de tâche accessible |
| `_objective_title` | `routers/tasks.py:L25` | titre lié optionnel |
| `serialize_task` | `routers/tasks.py:L32` | tâche vers JSON |
| `serialize_category` | `routers/time_allocation.py:L22` | catégorie vers JSON |
| `_update_category` | `routers/time_allocation.py:L39` | applique PATCH sur objet ORM |
| `_is_supported_audio_type` | `routers/transcribe.py:L12` | MIME accepté par proxy |
| `read_positive_integer` | `services/whisper_service.py:L25` | configuration positive |
| `is_supported_audio_type` | `services/whisper_service.py:L41` | MIME accepté microservice |
| `ensure_ffmpeg_on_path` | `services/whisper_service.py:L45` | prépare exécutable FFmpeg |
| `load_model` | `services/whisper_service.py:L62` | charge Whisper, caché |

## 8. Index de toutes les méthodes de test

| Test | Fichier | Ce qu’il protège |
| --- | --- | --- |
| `setUpClass` | `test_api_boundaries.py` | client partagé |
| `test_health_exposes_only_public_state` | idem | 200 et clés publiques exactes |
| `test_transcription_requires_authentication` | idem | 401 uniforme |
| `test_daily_log_normalizes_camel_case_and_enum_case` | `test_contracts.py` | alias et enum |
| `test_daily_log_rejects_out_of_range_score` | idem | bornes 0..100 |
| `test_sleep_intent_offset_normalizes_to_utc` | idem | fuseau vers UTC |
| `test_calendar_rejects_reverse_time_range` | idem | fin avant début |
| `test_calendar_compares_mixed_timezone_inputs` | idem | comparaison aware/naive |
| `test_partial_objective_update_does_not_default_kind` | idem | sémantique PATCH |
| `test_habit_checkin_requires_habit_id` | idem | cible check-in |
| `test_allocation_update_requires_category_id` | idem | cible allocation |
| `test_portfolio_update_requires_name` | idem | nom portefeuille |
| `test_weekly_block_requires_date` | idem | date bloc |
| `test_settings_coerces_numeric_form_values` | idem | coercition numérique |
| `test_javascript_round_uses_positive_infinity_for_ties` | `test_numeric_parity.py` | demi-entiers JavaScript |
| `test_daily_log_state_score_matches_legacy_math_round` | idem | score historique 53 |
| `test_round_trip_session` | `test_security.py` | encode/décode |
| `test_malformed_session_is_rejected_without_error` | idem | huit familles de jetons invalides |
| `_signed_payload` | idem | helper statique de test |

## 9. Index complet des imports par fichier

### Assemblage et infrastructure

| Fichier | Imports externes/standard | Imports internes |
| --- | --- | --- |
| `run.py` | `uvicorn` | `app.config.get_settings` |
| `app/main.py` | `logging`; FastAPI `FastAPI`, `HTTPException`, `Request`, `RequestValidationError`, `CORSMiddleware`, `JSONResponse` | `get_settings`; 12 modules routeurs |
| `app/config.py` | `__future__.annotations`, `os`, `dataclass`, `lru_cache`, `Path`, `urllib.parse`, `dotenv.load_dotenv` | aucun |
| `app/database.py` | `Iterator`; SQLAlchemy `create_engine`, `DeclarativeBase`, `Session`, `sessionmaker` | `get_settings` |
| `app/security.py` | `base64`, `binascii`, `hashlib`, `hmac`, `json`, `time`; FastAPI; SQLAlchemy | `get_settings`, `get_db`, `User` |
| `app/ids.py` | `secrets`, `time`, future annotations | aucun |
| `app/models.py` | `date`, `datetime`, `timezone`; types/ORM SQLAlchemy; PostgreSQL `ENUM`, `JSONB` | `Base`, `new_id` |

### Contrats

| Fichier | Imports |
| --- | --- |
| `contracts/common.py` | future annotations; `BaseModel`, `ConfigDict`, `to_camel` |
| `contracts/enums.py` | future annotations; `Enum` |
| `contracts/daily_log.py` | future annotations; alias `Date`, `DateTime`; `Field`; `ApiRequest`, `DailyLogStatus` |
| `contracts/tasks.py` | future annotations; alias `Date`; `Field`; `ApiRequest`, `TaskImportance`, `TaskStatus` |
| `contracts/calendar_events.py` | future annotations; `datetime`; `Field`, `model_validator`; `to_utc_naive`, `ApiRequest`, enums calendrier |
| `contracts/habits.py` | future annotations; alias `Date`; `Literal`; `Field`, `model_validator`; `ApiRequest` |
| `contracts/objectives.py` | future annotations; alias `Date`; `Literal`; Pydantic; `ApiRequest`; cinq enums objectif/planning |
| `contracts/settings.py` | future annotations; `Field`; `ApiRequest` |
| `contracts/time_allocation.py` | future annotations; alias `Date`; `Literal`; Pydantic; `ApiRequest` |

### Core

| Fichier | Imports externes/standard | Imports internes |
| --- | --- | --- |
| `core/dates.py` | `date`, `datetime`, `timedelta`, `timezone` | aucun |
| `core/numbers.py` | `math` | aucun |
| `core/habits.py` | SQLAlchemy `select`, PostgreSQL `insert`, `Session` | `Habit`, `HabitCheckin`, `RoutineBlock`, `utcnow`; dates; `javascript_round` |
| `core/history.py` | `select`, `Session` | `DailyLog`; dates; `compute_weekly_summary` |
| `core/life_terminal.py` | `datetime`, `time`; `select`, `Session` | quatre modèles; dates; metrics; numbers; regime; scoring; time allocation; todo metrics |
| `core/metrics.py` | `datetime`, `timezone`; `select`, `Session` | `CalendarEvent`, `DailyLog`; dates; numbers; todo metrics |
| `core/objectives.py` | `datetime`, `time`; SQLAlchemy `func`, `select`, `update`, `Session` | `CalendarEvent`, `Objective`, `Task`, `WeeklyPlanBlock`; dates; numbers |
| `core/regime.py` | future annotations | `javascript_round` |
| `core/reports.py` | `select`, `Session` | `WeeklyReport`; semaine; export metrics |
| `core/scoring.py` | `timedelta`; SQLAlchemy `func`, `select`, `Session` | `DailyLog`; dates; metrics; regime; todo metrics |
| `core/time_allocation.py` | `math`; `select`, PostgreSQL `insert`, `Session` | trois modèles + `utcnow`; dates; numbers |
| `core/todo_metrics.py` | `select`, `Session` | `CalendarEvent`, `Task`; dates; numbers |

### Routeurs

| Fichier | Imports externes | Imports internes |
| --- | --- | --- |
| `routers/auth.py` | FastAPI `APIRouter`, `Depends`, `Response`; `JSONResponse`; Pydantic `BaseModel`; `Session` | `get_db`; trois fonctions sécurité |
| `routers/calendar_events.py` | `datetime`, `time`, `timedelta`; FastAPI; `select`, `Session` | contrats, db, modèles, sécurité, dates, scoring |
| `routers/daily_log.py` | `Date`, `timedelta`; FastAPI; SQLAlchemy `case`, `select`, PostgreSQL `insert`, `Session` | contrat, db, modèles, sécurité, dates, scoring, todo metrics |
| `routers/habits.py` | FastAPI; SQLAlchemy `select`, `update`, `Session` | contrats, db, modèles, sécurité, dates, core habits |
| `routers/history.py` | `Literal`; FastAPI; `Session` | core history, db, `User`, sécurité |
| `routers/life_terminal.py` | FastAPI; `Session` | db, `User`, sécurité, dates, core terminal |
| `routers/objectives.py` | FastAPI; SQLAlchemy `select`, `update`, `Session` | enums/contrats, db, modèles, sécurité, dates, core objectives |
| `routers/reports.py` | FastAPI; `JSONResponse`; `Session` | db, `User`, sécurité, semaine, rapport |
| `routers/settings.py` | FastAPI; `Session` | contrat, db, `User`, sécurité |
| `routers/tasks.py` | FastAPI; SQLAlchemy `and_`, `select`, `Session` | contrats, db, modèles, sécurité, dates, scoring |
| `routers/time_allocation.py` | FastAPI; `select`, `Session` | contrats, db, modèles, sécurité, dates, core temps |
| `routers/transcribe.py` | `httpx`; FastAPI `APIRouter`, `Depends`, `File`, `HTTPException`, `UploadFile` | configuration, `User`, sécurité |

### Microservice et tests

| Fichier | Imports |
| --- | --- |
| `services/whisper_service.py` | `asyncio`, `logging`, `os`, `shutil`, `tempfile`, `lru_cache`, `Path`, `imageio_ffmpeg`, `whisper`, `load_dotenv`, `run_in_threadpool`, FastAPI et CORS |
| `scripts/course_timer.py` | future annotations, bibliothèque standard `argparse` et `time`; aucun import interne |
| `tests/test_api_boundaries.py` | future annotations, `unittest`, `TestClient`, `app.main.app` |
| `tests/test_contracts.py` | future annotations, `unittest`, `ValidationError`, six modules contrats, `to_utc_naive` |
| `tests/test_numeric_parity.py` | future annotations, `unittest`, `SimpleNamespace`, `compute_state_score`, `javascript_round` |
| `tests/test_security.py` | future annotations, `unittest`, quatre helpers session |

Les `__init__.py` n’ont aucun import, à l’exception de `contracts/__init__.py` qui contient seulement son marqueur/doc minimale selon l’état analysé.

## 10. Index des dépendances indirectes et callbacks

| Callback/mécanisme | Déclaré où | Déclencheur |
| --- | --- | --- |
| routes `@app/@router` | main, routeurs, service | FastAPI après correspondance HTTP |
| gestionnaires `@app.exception_handler` | `main.py` | Starlette après exception |
| CORS | deux applications | middleware autour de requête/réponse |
| `get_db` | `database.py` | injection `Depends` |
| `get_current_user` | `security.py` | injection `Depends` des routes protégées |
| validateurs `@model_validator` | trois contrats + calendrier | Pydantic après champs |
| `_missing_` | `contracts/enums.py` | machinery `Enum` sur valeur non exacte |
| propriétés `Settings.*` | `config.py` | accès attribut |
| cache `get_settings` | `config.py` | wrapper `lru_cache` lors des appels |
| cache `load_model` | `whisper_service.py` | wrapper `lru_cache` lors des transcriptions |
| `new_id` | `models.py` defaults | SQLAlchemy lors d’un INSERT |
| `utcnow` | `models.py` defaults/onupdate | SQLAlchemy lors INSERT/UPDATE |
| `previous_value(selector)` | `life_terminal.py` | appels internes avec sélecteur |
| `collect(selector)` | `metrics.py` | appels internes avec sélecteur |
| `run_in_threadpool(load_model)` | service Whisper | pool appelle le callable |
| `run_in_threadpool(model.transcribe, path)` | service Whisper | pool appelle la méthode liée |

## 11. Index des commandes

| Commande | Dossier | Effet |
| --- | --- | --- |
| `python -m venv .venv` | `interface_API` | crée environnement virtuel |
| `.\.venv\Scripts\Activate.ps1` | `interface_API` | active venv PowerShell |
| `python -m pip install -r requirements.txt` | `interface_API` | installe dépendances Python |
| `Copy-Item .env.example .env` | `interface_API` | crée configuration locale à compléter |
| `python run.py` | `interface_API` | démarre API métier avec reload |
| `uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload` | `interface_API` | lancement Uvicorn explicite |
| `python -m uvicorn services.whisper_service:app --host 127.0.0.1 --port 8001` | racine | lancement manuel logique du service Whisper |
| `python -m unittest discover -s tests -v` | `interface_API` | tous les tests Python |
| `python -m unittest tests.test_contracts -v` | `interface_API` | tests de contrats |
| `pnpm test:api` | racine | script projet des tests API |
| `pnpm typecheck` | racine | vérifie TypeScript |
| `pnpm build` | racine | build frontend/projet |
| `pnpm check` | racine | typecheck + tests API + build |
| `pnpm prisma:generate` | racine | régénère client Prisma |
| `pnpm prisma:migrate --name nom_precis` | racine | migration développement nommée |
| `rg --files -g "*.py"` | racine | liste sources Python ; exclure `.venv` si nécessaire |
| `rg -n "Depends\(" interface_API/app` | racine | localise injections |
| `rg -n "@router\." interface_API/app/routers` | racine | localise routes |
| `git status --short` | racine | état des modifications |
| `python scripts/course_timer.py` | racine | lance le compte à rebours de 300 secondes |
| `python scripts/course_timer.py --seconds 30` | racine | lance un compte à rebours de 30 secondes |

La commande du microservice est déduite de l’objet ASGI réel et du port configuré dans `.env`; le dépôt principal le lance aussi selon son orchestration locale. Elle ne doit pas être confondue avec `python interface_API/run.py`.

## 12. Index des codes et erreurs

| Code/type | Sens dans ce projet | Sources principales |
| --- | --- | --- |
| 200 | succès par défaut | toutes routes réussies |
| 201 | sémantique création, mais les POST actuels ne déclarent pas explicitement 201 | aucun endpoint actuel garanti 201 |
| 400 | commande/identifiant/plage métier invalide | daily log, tâches, calendrier, habitudes, objectifs, temps |
| 401 | clé de login ou session invalide | auth, `get_current_user` |
| 403 | aucun `HTTPException(403)` explicite dans le code analysé | non utilisé actuellement |
| 404 | ressource de l’utilisateur introuvable | tâches, calendrier, habitudes, objectifs, temps |
| 409 | aucun `HTTPException(409)` actuel | proposé seulement au chapitre 11 |
| 413 | audio trop grand | proxy et microservice |
| 415 | type audio non accepté | proxy et microservice |
| 422 | validation FastAPI/Pydantic ; plage calendrier fusionnée ; audio non transcrivable | handler, calendrier, Whisper |
| 429 | service Whisper occupé | sémaphore microservice |
| 500 | exception inattendue masquée ; échec Whisper interne | main, service |
| 502 | réponse Whisper amont en erreur/invalide | proxy transcription |
| 503 | Whisper injoignable/erreur client HTTP | proxy transcription |

### Messages explicites applicatifs

`Request validation failed`; `Internal server error`; `Unauthorized`; `Invalid daily-log status range`; `Invalid objectiveId`; `Task not found`; `Missing event id`; `Event not found`; `Event end must be after its start`; `Invalid habitId`; `Habit not found`; `Missing habit id`; `Objective hierarchy cannot contain a cycle`; `Invalid parentId`; `Missing id`; `Weekly block not found`; `Objective not found`; `Invalid categoryId`; `Allocation category not found`; `Missing category id`; `Unsupported audio type`; `Audio file is too large`; `Whisper service is unavailable`; `Whisper request failed`; `Transcription failed`; `Whisper returned invalid JSON`; `Transcription service is busy`; `Audio could not be transcribed`; `Whisper transcription failed`.

### Erreurs de configuration/calcul

`<NAME> must be an integer`; `<NAME> must be greater than zero`; `APP_ACCESS_KEY and AUTH_SECRET are required in production`; `Unsupported history filter`; `Cannot round a non-finite value`.

Le timer auxiliaire lève `ValueError("La durée doit être strictement positive.")` pour une durée nulle ou négative, puis `main` la convertit en `SystemExit`. `KeyboardInterrupt`, provoqué typiquement par `Ctrl+C`, affiche `Timer interrompu.` au lieu d’un traceback. Ces erreurs n’ont aucun statut HTTP, car le script est un programme terminal hors API.

### Erreurs de validateurs Pydantic

`end must be after start`; `habitId is required for a check-in`; `id is required for a habit update`; `categoryId is required for an allocation update`; `name is required for a portfolio update`; `id is required for a category update`; `date is required for a weekly block`; plus les messages automatiques de `Field` pour bornes/longueurs/types.

## 13. Index des tables et clés logiques

| Table | Clé primaire | Liens texte utilisés |
| --- | --- | --- |
| `User` | `id` | racine utilisateur |
| `DailyLog` | `id` | `userId`, date |
| `Task` | `id` | `userId`, `objectiveId`, date |
| `TimeAllocationCategory` | `id` | `userId` |
| `DailyTimeAllocation` | `id` | `userId`, `categoryId`, date |
| `DailyPlanningContext` | `id` | `userId`, date |
| `Habit` | `id` | `userId` |
| `HabitCheckin` | `id` | `userId`, `habitId`, date |
| `RoutineBlock` | `id` | `userId`, `habitId` |
| `CalendarEvent` | `id` | `userId`, start/end |
| `WeeklyReport` | `id` | `userId`, `weekId` |
| `Objective` | `id` | `userId`, `parentId`, `weekId` |
| `WeeklyPlanBlock` | `id` | `userId`, `objectiveId`, date |

Les classes ne déclarent pas de `ForeignKey` ni `relationship()` dans ce mapping. Les liens sont maintenus par identifiants, requêtes et validations applicatives, tandis que le schéma effectif reste celui de Prisma.

## 14. Carte inverse : fonctionnalité vers fichiers

| Fonctionnalité | Fichiers principaux |
| --- | --- |
| démarrage | `run.py` → `config.py` → `main.py` |
| transaction | `database.py` + toute route via `Depends` |
| session | `routers/auth.py`, `security.py`, `models.User` |
| journal | `contracts/daily_log.py`, `routers/daily_log.py`, `core/scoring.py`, `core/metrics.py`, `models.DailyLog` |
| tâches | `contracts/tasks.py`, `routers/tasks.py`, `core/todo_metrics.py`, scoring, `models.Task` |
| calendrier | contrat/route calendrier, dates, todo metrics, scoring, `CalendarEvent` |
| habitudes | contrat/route/core habits, `Habit`, `HabitCheckin`, `RoutineBlock` |
| objectifs | contrat/enums/route/core objectives, `Objective`, `WeeklyPlanBlock`, `Task` |
| temps | contrat/route/core time allocation, trois modèles temps |
| historique | route/core history, metrics, `DailyLog` |
| rapport | route/core reports, metrics, `WeeklyReport` |
| terminal | route/core life terminal + presque tous les domaines analytiques |
| transcription | route proxy, config, sécurité, HTTP, service Whisper, FFmpeg |

## 15. Checklist d’usage de l’index

Pour comprendre une route, retrouvez-la dans l’index des routes, ouvrez sa fonction, consultez ses imports internes, remontez son contrat et ses helpers, puis relevez ses modèles. Pour modifier une fonction, recherchez son nom dans tout le dépôt, consultez les callbacks indirects et les tests. Pour une erreur, partez du code/statut et suivez la source listée. Pour un changement de table, partez toujours du schéma Prisma avant ce mapping SQLAlchemy.
