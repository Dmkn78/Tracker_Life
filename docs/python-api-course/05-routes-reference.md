# Partie 6 — Référence complète des routes

## Comment utiliser cette référence

Ce chapitre documente toutes les routes réellement enregistrées par `interface_API/app/main.py`, puis les deux routes de `services/whisper_service.py`. Il n'ajoute aucune route imaginaire.

Les exemples utilisent des identifiants fictifs mais conformes à la forme CUID produite par `new_id`, par exemple `clz8abc4q4m7x9k2p6r0t5v3`. Lorsqu'une réponse calculée est trop volumineuse pour un exemple, sa liste exhaustive de clés est donnée juste avant ou après l'extrait. Sauf mention contraire :

- le succès vaut `200`, car les décorateurs ne déclarent aucun autre `status_code` ;
- une route protégée exige le cookie `life_regime_session` ;
- l'absence d'utilisateur valide donne `401 {"error":"Unauthorized"}` ;
- une violation Pydantic donne `422` dans la forme `{error, details}` de `main.py` ;
- une erreur non prévue donne `500 {"error":"Internal server error"}` et entraîne un rollback ;
- `db.flush()` est suivi du `commit()` de la dépendance `get_db` si la requête se termine normalement.

## 1. Inventaire

| # | Méthode | URL | Authentification | Fonction |
|---:|---|---|---|---|
| 1 | GET | `/api/health` | non | `main.health` |
| 2 | POST | `/api/auth/login` | access key dans le JSON | `auth.login` |
| 3 | POST | `/api/auth/logout` | non | `auth.logout` |
| 4 | GET | `/api/calendar-events` | cookie | `calendar_events.list_events` |
| 5 | POST | `/api/calendar-events` | cookie | `calendar_events.create_event` |
| 6 | PATCH | `/api/calendar-events` | cookie | `calendar_events.update_event` |
| 7 | DELETE | `/api/calendar-events` | cookie | `calendar_events.delete_event` |
| 8 | GET | `/api/daily-log/statuses` | cookie | `daily_log.get_daily_log_statuses` |
| 9 | GET | `/api/daily-log` | cookie | `daily_log.get_daily_log` |
| 10 | POST | `/api/daily-log` | cookie | `daily_log.upsert_daily_log` |
| 11 | GET | `/api/habits` | cookie | `habits.get_habits` |
| 12 | POST | `/api/habits` | cookie | `habits.create_habit` |
| 13 | PATCH | `/api/habits` | cookie | `habits.update_habit` |
| 14 | DELETE | `/api/habits` | cookie | `habits.delete_habit` |
| 15 | GET | `/api/history` | cookie | `history.get_history` |
| 16 | GET | `/api/life-terminal` | cookie | `life_terminal.life_terminal` |
| 17 | GET | `/api/objectives` | cookie | `objectives.get_objectives` |
| 18 | POST | `/api/objectives` | cookie | `objectives.create_objective` |
| 19 | PATCH | `/api/objectives` | cookie | `objectives.update_objective` |
| 20 | DELETE | `/api/objectives` | cookie | `objectives.delete_objective` |
| 21 | GET | `/api/reports/week` | cookie | `reports.weekly_report` |
| 22 | GET | `/api/settings` | cookie | `settings.get_settings_route` |
| 23 | PATCH | `/api/settings` | cookie | `settings.update_settings` |
| 24 | GET | `/api/tasks` | cookie | `tasks.list_tasks` |
| 25 | POST | `/api/tasks` | cookie | `tasks.create_tasks` |
| 26 | PATCH | `/api/tasks` | cookie | `tasks.update_task` |
| 27 | GET | `/api/time-allocation` | cookie | `time_allocation.get_time_allocation` |
| 28 | POST | `/api/time-allocation` | cookie | `time_allocation.create_category` |
| 29 | PATCH | `/api/time-allocation` | cookie | `time_allocation.update_time_allocation` |
| 30 | DELETE | `/api/time-allocation` | cookie | `time_allocation.delete_category` |
| 31 | POST | `/api/transcribe` | cookie | `transcribe.transcribe` |
| 32 | GET | service Whisper `/health` | non | `whisper_service.health` |
| 33 | POST | service Whisper `/transcribe` | non | `whisper_service.transcribe` |

Il n'existe aucune route `PUT`, aucun `DELETE /api/tasks`, aucun endpoint public de création d'utilisateur, et aucun préfixe de version comme `/v1`.

## 2. Catalogue exact des corps JSON

Cette section évite de répéter vingt champs à chaque endpoint. Chaque fiche de route renvoie vers le contrat exact ci-dessous.

### `LoginBody`

Défini directement dans `routers/auth.py`, il n'hérite pas d'`ApiRequest` :

| Champ JSON | Type | Défaut | Règle |
|---|---|---|---|
| `accessKey` | chaîne | `""` | comparée à la clé configurée |

### `CalendarEventCreateRequest`

| Champ JSON | Type | Défaut/règle |
|---|---|---|
| `title` | chaîne | `"Untitled event"` |
| `type` | enum | `PERSONAL`; exam/interview/deadline/admin/social/training/recovery/travel/personal |
| `start` | date-heure | obligatoire |
| `end` | date-heure ou `null` | défaut `null`; si présent, pas avant `start` |
| `impact` | enum | `MEDIUM`; low/medium/high/critical |
| `expectedStress` | entier | 50, entre 0 et 100 |
| `expectedPreparationLoad` | entier | 50, entre 0 et 100 |

### `CalendarEventUpdateRequest`

`id` est une chaîne obligatoire non vide. Tous les autres champs sont facultatifs : `title`, `type`, `start`, `end`, `impact`, `expectedStress` (0–100) et `expectedPreparationLoad` (0–100). Si `start` et `end` sont tous les deux fournis, le contrat vérifie leur ordre ; la route vérifie aussi l'intervalle final combiné avec les anciennes valeurs.

### `DailyLogUpsertRequest`

| Champ JSON | Type | Défaut/règle |
|---|---|---|
| `date` | date ou `null` | aujourd'hui dans la route |
| `status` | enum | `DRAFT`; empty/draft/submitted/analyzed/missing/skipped |
| `energy`, `productivity`, `startFriction` | entier ou `null` | 0–100 |
| `calorieTarget` | entier ou `null` | 0–20 000 |
| `caloriePercent` | entier ou `null` | 0–500 |
| `trainingDone` | booléen ou `null` | facultatif |
| `mentalFatigue`, `physicalFatigue`, `focusQuality` | entier ou `null` | 0–100 |
| `workTimeMinutes`, `distractionTimeMinutes` | entier ou `null` | 0–1 440 |
| `avoidedImportantTask` | booléen ou `null` | facultatif |
| `mainBlocker`, `improvementTomorrow` | chaîne ou `null` | facultatif |
| `sleepIntentClickedAt` | date-heure ou `null` | facultatif |
| `estimatedSleepDelayMin` | entier ou `null` | 0–1 440 |
| `textSummary`, `voiceTranscript` | chaîne ou `null` | facultatif |

### `HabitCreateRequest`

| Champ JSON | Type | Défaut/règle |
|---|---|---|
| `name` | chaîne | `"New habit"` |
| `category` | chaîne | `"routine"` |
| `description`, `targetTime` | chaîne ou `null` | facultatif |
| `defaultExpectedMinutes` | entier | 0–1 440, défaut 0 |
| `sortOrder` | entier | défaut 99 |

### `HabitUpdateRequest`

Deux commandes partagent un contrat :

- check-in : `kind="checkin"`, `habitId` obligatoire, `date`, `status`, `actualMinutes` (0–1 440) et `note` facultatifs ;
- modification d'habitude : `kind` absent/`null`, `id` obligatoire, puis `name`, `category`, `description`, `targetTime`, `defaultExpectedMinutes`, `sortOrder`, `active` facultatifs.

Le modèle contient à la fois `id` et `habitId` car la cible n'est pas exprimée de la même façon dans les deux branches.

### `ObjectiveCreateRequest`

| Champ JSON | Type | Défaut/règle |
|---|---|---|
| `kind` | objective/project/milestone/weekly_block/bootstrap_demo | `OBJECTIVE` |
| `weekId`, `objectiveId`, `parentId` | chaîne ou `null` | facultatif |
| `title`, `summary`, `nextAction` | chaîne ou `null` | facultatif |
| `horizon` | year/quarter/month/week | `WEEK` |
| `status` | planned/active/on_track/at_risk/paused/done | `PLANNED` |
| `priority` | low/medium/high/critical | `MEDIUM` |
| `targetDate` | date ou `null` | facultatif |
| `color` | chaîne | `#8da2fb` |
| `sortOrder` | entier | 0 |
| `linkedTaskIds` | liste de chaînes | nouvelle liste vide |
| `category` | work/study/sport/rest/admin/personal/social/travel | `WORK` |
| `date` | date ou `null` | obligatoire seulement pour `weekly_block` selon le validateur |
| `startTime`, `endTime` | chaîne ou `null` | facultatif |
| `durationMinutes` | entier | 0–10 080, défaut 60 |
| `flexible` | booléen | faux |
| `note` | chaîne ou `null` | facultatif |

### `ObjectiveUpdateRequest`

`id` est obligatoire et non vide. `kind` peut être un enum objectif ou `weekly_block`. Tous les autres champs sont facultatifs : `weekId`, `objectiveId`, `parentId`, `title`, `summary`, `nextAction`, `horizon`, `status`, `priority`, `targetDate`, `color`, `sortOrder`, `archived`, `linkedTaskIds`, `category`, `date`, `startTime`, `endTime`, `durationMinutes` (0–10 080), `flexible`, `note`.

### `SettingsUpdateRequest`

- `calorieTarget` : entier ou `null`, 0–20 000 ;
- `defaultSleepDelayMin` : entier ou `null`, 0–1 440.

### `TaskCreateRequest`

| Champ JSON | Type | Défaut/règle |
|---|---|---|
| `title` | chaîne ou `null` | si `titles` absent, repli `Untitled task` |
| `titles` | liste de chaînes ou `null` | permet une création multiple |
| `date` | date ou `null` | aujourd'hui |
| `objectiveId` | chaîne ou `null` | doit appartenir à l'utilisateur |
| `importance` | low/medium/high | `MEDIUM` |
| `productive` | booléen | vrai |
| `estimatedMinutes` | entier | 0–10 080, défaut 0 |
| `completionPercent` | entier | 0–100, défaut 0 |
| `status` | planned/in_progress/done/postponed/cancelled | `PLANNED` |

### `TaskUpdateRequest`

`id` est obligatoire et non vide. `title`, `date`, `objectiveId`, `importance`, `productive`, `estimatedMinutes` (0–10 080), `completionPercent` (0–100) et `status` sont facultatifs.

### `TimeAllocationCategoryCreateRequest`

`name` vaut `New allocation` par défaut ; `objective` est facultatif ; `targetWeight`, `expectedReturn` et `risk` sont des entiers 0–100 ; `beta` est un nombre 0–10 ; `color` vaut `#22d3ee`. Les défauts numériques sont respectivement 0, 50, 50 et 1.

### `TimeAllocationUpdateRequest`

Le champ `kind` sélectionne une branche : `day_budget`, `allocation`, `portfolio` ou `null`.

- communs : `id`, `date` ;
- budget : `dayBudgetMinutes` entre 0 et 1 440 ;
- allocation : `categoryId` obligatoire, `plannedMinutes` et `actualMinutes` entre 0 et 10 080, `plannedMinutesManual`, `note` ;
- portfolio : `name` non vide obligatoire, puis champs d'allocation et propriétés de catégorie ;
- catégorie normale (`kind=null`) : `id` obligatoire, `name`, `objective`, `targetWeight`, `expectedReturn`, `risk`, `beta`, `color`, `active` facultatifs.

## 3. Routes publiques et authentification

### 3.1 `GET /api/health`

**Signature exacte.** `def health() -> dict[str, bool]`. Les parenthèses vides signifient qu'aucun argument n'est construit depuis la requête ; l'annotation de retour annonce des clés chaîne et valeurs booléennes.

**Objectif.** Vérifier que le processus de l'API principale répond.

**Entrée.** Aucun paramètre, aucun corps, aucune authentification.

**Exécution et base.** Appelle `get_settings().is_using_dev_access_key`. Aucun accès à la base ni à Whisper. Ce health check ne garantit donc pas que PostgreSQL fonctionne.

**Réponse.**

```json
{"ok": true, "usingDevAccessKey": false}
```

`usingDevAccessKey` est vrai lorsque `APP_ACCESS_KEY` est vide et que la clé de développement de repli est utilisée.

**Erreurs.** Une erreur de configuration lors de l'import peut empêcher le serveur de démarrer ; une fois démarré, la route ne déclare aucune erreur métier.

```bash
curl http://127.0.0.1:8000/api/health
```

### 3.2 `POST /api/auth/login`

**Signature exacte.** `def login(body: LoginBody, db: Session = Depends(get_db))`. `body` vient du JSON ; `db` vient de la dépendance génératrice.

**Objectif.** Échanger une access key contre un cookie de session signé.

**Entrée.** JSON `LoginBody`, sans cookie préalable.

```json
{"accessKey": "dev-access-key"}
```

**Ordre et base.** FastAPI construit `LoginBody` puis injecte `db`. `authenticate_access_key` compare en temps constant la valeur à `get_settings().access_key`. Si elle correspond, `ensure_local_user` sélectionne le premier `User` par `createdAt`; s'il n'existe pas, il crée `User(label="Local user")`, l'ajoute et le flush. La route crée `JSONResponse`, puis `set_session_cookie` encode l'id et une expiration à 30 jours, signe le corps HMAC-SHA256 et ajoute `Set-Cookie`.

**Réponse de succès.** Corps :

```json
{"ok": true}
```

Le header `Set-Cookie` contient `life_regime_session`, `HttpOnly`, `SameSite=lax`, `Path=/`, `Max-Age=2592000`, et `Secure` en production.

**Erreurs.** Mauvaise clé : `401 {"error":"Invalid access key"}` créé directement par la route. Validation de `accessKey` non chaîne : `422`. Erreur DB : `500` et rollback.

```bash
curl -i -c cookies.txt -X POST http://127.0.0.1:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"accessKey":"dev-access-key"}'
```

### 3.3 `POST /api/auth/logout`

**Signature exacte.** `def logout(response: Response)`. FastAPI reconnaît le type `Response` et fournit un objet réponse, que le corps de fonction remplace ensuite par un `JSONResponse` local.

**Objectif.** Demander au navigateur de supprimer le cookie.

**Entrée.** Aucune. La route n'est pas protégée : elle fonctionne même sans session.

**Exécution et base.** Aucun accès DB. FastAPI fournit initialement un `Response`, mais la fonction remplace cette variable par un nouveau `JSONResponse`. `clear_session_cookie` appelle `delete_cookie(COOKIE_NAME, path="/")` sur ce nouveau résultat.

**Réponse.** `200 {"ok":true}` avec un `Set-Cookie` expirant/supprimant `life_regime_session`.

```bash
curl -i -b cookies.txt -X POST http://127.0.0.1:8000/api/auth/logout
```

## 4. Événements du calendrier

Toutes les routes de cette section sont protégées et utilisent les lignes `CalendarEvent` limitées par `userId`.

### 4.1 `GET /api/calendar-events`

**Signature exacte.**

```python
def list_events(
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
)
```

`from_` évite le mot réservé Python `from`; `alias="from"` conserve le nom HTTP attendu.

**Objectif.** Lister les événements dont le début appartient à une fenêtre.

**Paramètres.** `from` et `to`, chaînes facultatives au format de date attendu par `parse_date_key`. `from` vaut aujourd'hui par défaut. `to` vaut `from + 30 jours` par défaut.

**Exécution DB.** La route construit `start` à `00:00:00` du jour `from` et `end` à `23:59:59.999999` du jour `to`. Elle sélectionne `CalendarEvent` avec `start >= début` et `start < fin`, triés par début croissant. La limite porte sur le **début** de l'événement, pas sur tout chevauchement d'intervalle.

**Réponse.**

```json
{
  "events": [{
    "id": "clz8abc2q4m7x9k2p6r0t5v3",
    "userId": "clz8abc1q4m7x9k2p6r0t5v3",
    "title": "Examen",
    "type": "exam",
    "impact": "high",
    "start": "2026-08-02T09:00:00",
    "end": "2026-08-02T11:00:00",
    "expectedStress": 80,
    "expectedPreparationLoad": 90,
    "createdAt": "2026-08-01T08:00:00",
    "updatedAt": "2026-08-01T08:00:00"
  }]
}
```

**Erreurs.** `401`; une chaîne de date impossible n'est pas validée par l'annotation `str` et peut finir en erreur interne lors du parsing.

```bash
curl -b cookies.txt "http://127.0.0.1:8000/api/calendar-events?from=2026-08-01&to=2026-08-31"
```

### 4.2 `POST /api/calendar-events`

**Signature exacte.** `def create_event(body: CalendarEventCreateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db))`.

**Objectif.** Créer un événement.

**Corps.** `CalendarEventCreateRequest`. `start` est obligatoire. Si `end` est absent, la route choisit `start + 1 heure`.

**Ordre et DB.** Pydantic valide l'intervalle si `end` existe. La route normalise les dates avec `to_utc_naive`, crée `CalendarEvent`, exécute `add` et `flush`, puis appelle `recompute_around_date` pour le jour de début afin de recalculer les scores du journal concerné et, s'il existe, celui du lendemain.

**Réponse.** Un objet `event` contenant exactement les onze champs montrés dans la réponse de la route de liste : `id`, `userId`, `title`, `type`, `impact`, `start`, `end`, `expectedStress`, `expectedPreparationLoad`, `createdAt`, `updatedAt`.

**Erreurs.** `422` pour champ invalide ou `end < start`; `401`; `500` DB. Aucun `201` : succès `200`.

```bash
curl -b cookies.txt -X POST http://127.0.0.1:8000/api/calendar-events \
  -H "Content-Type: application/json" \
  -d '{"title":"Examen","type":"exam","start":"2026-08-02T09:00:00+02:00","impact":"high","expectedStress":80}'
```

### 4.3 `PATCH /api/calendar-events`

**Signature exacte.** `def update_event(body: CalendarEventUpdateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db))`.

**Objectif.** Modifier seulement les champs fournis d'un événement.

**Corps.** `CalendarEventUpdateRequest`; `id` obligatoire.

**Ordre et DB.** Sélection par `(id, userId)`, sinon `404`. La route mémorise l'ancien jour. Elle combine `body.start` ou l'ancien début et `body.end` ou l'ancienne fin, puis refuse si la fin finale précède le début final. Elle affecte uniquement les champs non `None`, flush, recalcule autour de l'ancien jour puis du nouveau jour.

**Réponse.** Un objet `event` contenant exactement les onze champs du sérialiseur `serialize_event` listés au paragraphe 4.1.

**Erreurs.** `404 Event not found`; `422 Event end must be after its start` pour le contrôle de route ; `422` de validation ; `401`; `500`.

```bash
curl -b cookies.txt -X PATCH http://127.0.0.1:8000/api/calendar-events \
  -H "Content-Type: application/json" \
  -d '{"id":"clz8abc2q4m7x9k2p6r0t5v3","impact":"critical","expectedPreparationLoad":100}'
```

### 4.4 `DELETE /api/calendar-events`

**Signature exacte.** `def delete_event(id: str | None = Query(default=None), user: User = Depends(get_current_user), db: Session = Depends(get_db))`.

**Objectif.** Supprimer physiquement un événement.

**Paramètre.** Query `id`, facultatif pour FastAPI mais obligatoire selon la route.

**Ordre et DB.** Sans id : `400`. Sélection par `(id,userId)`, sinon `404`. Mémorise le jour, appelle `db.delete`, flush, puis recalcule les scores autour de ce jour.

**Réponse.** `{"ok":true}`.

**Erreurs.** `400 Missing event id`; `404 Event not found`; `401`; `500`.

```bash
curl -b cookies.txt -X DELETE "http://127.0.0.1:8000/api/calendar-events?id=clz8abc2q4m7x9k2p6r0t5v3"
```

## 5. Journal quotidien

### 5.1 `GET /api/daily-log/statuses`

**Signature exacte.**

```python
def get_daily_log_statuses(
    from_date: Date = Query(alias="from"),
    to_date: Date = Query(alias="to"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
)
```

Contrairement aux routes annotées `str`, ces deux paramètres sont convertis en objets `datetime.date` par FastAPI avant l'appel.

**Objectif.** Lire les statuts d'une plage de jours, pour un calendrier par exemple.

**Paramètres.** `from` et `to` sont deux dates obligatoires. Comme l'annotation est `datetime.date`, FastAPI/Pydantic les valide avant la fonction. La borne `to` est exclusive dans la requête SQL.

**Règle.** `(to - from).days` doit être compris entre 0 et 70 inclus. Cela autorise une différence de 70 jours, mais la requête `date < to` retourne au maximum les jours avant la borne.

**DB.** Sélection des `DailyLog` de l'utilisateur avec `date >= from` et `date < to`.

**Réponse.**

```json
{
  "statuses": {
    "2026-07-30": "submitted",
    "2026-07-31": "draft"
  }
}
```

Les jours sans ligne sont absents de l'objet.

**Erreurs.** `400 Invalid daily-log status range`; `422` si date absente/mal formée ; `401`; `500`.

```bash
curl -b cookies.txt "http://127.0.0.1:8000/api/daily-log/statuses?from=2026-07-01&to=2026-08-01"
```

### 5.2 `GET /api/daily-log`

**Signature exacte.** `def get_daily_log(date: str | None = Query(default=None), user: User = Depends(get_current_user), db: Session = Depends(get_db))`.

**Objectif.** Charger le journal, les métriques de tâches et le contexte calendrier d'un jour.

**Paramètre.** Query `date` facultatif, chaîne ; défaut aujourd'hui.

**DB et appels.** Sélectionne un `DailyLog` par `(userId,date)`. Appelle `get_todo_metrics`, qui sélectionne les tâches du jour et calcule planification/complétion. Appelle `get_calendar_context`, qui lit les événements de la semaine et des sept prochains jours.

**Réponse.**

```json
{
  "log": null,
  "todoMetrics": {
    "tasksPlanned": 0,
    "weightedCompletionRate": 0,
    "missedImportantTasks": 0,
    "productiveTaskCompletion": 0
  },
  "calendarContext": {
    "activePhase": "normal_week",
    "highImpactEventsNext7d": 0,
    "maxImpact": null,
    "averageStress": 0,
    "averagePreparationLoad": 0,
    "weeklyExpectedStressLoad": 0,
    "weeklyExpectedPreparationLoad": 0
  }
}
```

Si le journal existe, `log` contient tous les champs saisis plus `executionScore`, `stateScore`, `riskScore`, `riskDelta`, `riskAcceleration`, `regime`, `regimeConfidence`, `submittedAt` et `updatedAt`.

**Erreurs.** `401`; date chaîne non parsable pouvant produire `500`; erreurs DB `500`.

### 5.3 `POST /api/daily-log`

**Signature exacte.** `def upsert_daily_log(body: DailyLogUpsertRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db))`.

**Objectif.** Faire un *upsert* : insérer le journal du jour s'il n'existe pas, sinon le mettre à jour.

**Corps.** `DailyLogUpsertRequest` complet décrit plus haut.

**Ordre exact.** La date vaut celle du corps ou aujourd'hui. Le statut enum est converti par `.value`. `sleepIntentClickedAt` est normalisé ; `estimatedSleepStart` vaut instant du clic + délai uniquement si les deux valeurs sont évaluées vraies. Conséquence réelle : un délai `0` donne `estimatedSleepStart=None` à cause du test `if sleep_intent_clicked_at and estimated_sleep_delay_min`.

La route construit un `INSERT ... ON CONFLICT DO UPDATE` PostgreSQL sur `(userId,date)`. Si le nouveau statut est `DRAFT` et que l'ancien statut est `SUBMITTED`, `SKIPPED` ou `ANALYZED`, l'ancien statut est protégé ; les autres valeurs sont cependant mises à jour. Un statut non-DRAFT remplace le statut. `submittedAt` est mis à l'heure courante pour `SUBMITTED`.

Après exécution et flush, `recompute_around_date` recalcule les scores. Les métriques de tâches et le contexte calendrier sont relus.

**Réponse.** Même enveloppe que `GET /api/daily-log`, avec le journal sérialisé recalculé.

**Erreurs.** `422` sur les bornes/enum/date ; `401`; `500` DB. Succès `200`, pas `201`, car l'opération peut créer ou mettre à jour.

```bash
curl -b cookies.txt -X POST http://127.0.0.1:8000/api/daily-log \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-07-31","status":"submitted","energy":70,"productivity":65,"trainingDone":true}'
```

## 6. Habitudes

### 6.1 `GET /api/habits`

**Signature exacte.** `def get_habits(date: str | None = Query(default=None), user: User = Depends(get_current_user), db: Session = Depends(get_db))`.

**Objectif.** Charger le tracker d'habitudes d'un jour.

**Paramètre.** `date` facultatif, défaut aujourd'hui.

**DB.** `get_habit_tracker_data` lit : habitudes actives triées, check-ins du jour, blocs de routine actifs `school_day`, check-ins des sept jours. Il calcule les taux.

**Réponse.**

```json
{
  "date": "2026-07-31",
  "habits": [{
    "id": "clz8abc3q4m7x9k2p6r0t5v3",
    "name": "Lire",
    "category": "routine",
    "description": null,
    "targetTime": "20:00",
    "defaultExpectedMinutes": 30,
    "sortOrder": 1,
    "source": "manual",
    "checkin": {"id": null, "status": "planned", "actualMinutes": 0, "note": ""}
  }],
  "routineBlocks": [],
  "metrics": {"completedToday": 0, "totalToday": 1, "completionRateToday": 0, "sevenDayCompletionRate": 0}
}
```

**Erreurs.** `401`; date non parsable/DB : `500`.

### 6.2 `POST /api/habits`

**Signature exacte.** `def create_habit(body: HabitCreateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db))`.

**Objectif.** Créer une habitude manuelle.

**Corps.** `HabitCreateRequest`.

**DB.** Construit `Habit` avec `userId`, valeurs du corps et `source="manual"`, puis `add` et `flush`.

**Réponse.**

```json
{"habit":{"id":"clz8abc3q4m7x9k2p6r0t5v3","userId":"clz8abc1q4m7x9k2p6r0t5v3","name":"Lire","category":"routine","description":null,"targetTime":"20:00","defaultExpectedMinutes":30,"sortOrder":1,"active":true,"source":"manual","createdAt":"2026-08-01T08:05:00","updatedAt":"2026-08-01T08:05:00"}}
```

**Erreurs.** `422`, `401`, `500`. Succès `200`.

```bash
curl -b cookies.txt -X POST http://127.0.0.1:8000/api/habits \
  -H "Content-Type: application/json" \
  -d '{"name":"Lire","targetTime":"20:00","defaultExpectedMinutes":30,"sortOrder":1}'
```

### 6.3 `PATCH /api/habits`

**Signature exacte.** `def update_habit(body: HabitUpdateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db))`.

**Objectif.** Cette URL réalise deux opérations selon `kind`.

**Branche check-in.** Corps `HabitUpdateRequest` avec `kind="checkin"` et `habitId`. La route vérifie l'habitude par `(id,userId)`, sinon `400 Invalid habitId`. `upsert_habit_checkin` fait un `INSERT ... ON CONFLICT DO UPDATE` pour `(userId,habitId,date)`, puis la route retourne tout le tracker.

```json
{"kind":"checkin","habitId":"clz8abc3q4m7x9k2p6r0t5v3","date":"2026-07-31","status":"done","actualMinutes":25,"note":"Lecture API"}
```

**Branche modification.** `kind` absent ou `null`, `id` obligatoire. Sélection par `(id,userId)`, sinon `404`. Seuls les champs non `None` sont affectés, puis flush. La réponse contient `habit` avec les treize champs montrés dans la réponse de création.

```json
{"id":"clz8abc3q4m7x9k2p6r0t5v3","name":"Lire Python","active":true}
```

**Erreurs.** `422` du validateur si cible absente ; `400 Invalid habitId`; `404 Habit not found`; `401`; `500`.

### 6.4 `DELETE /api/habits`

**Signature exacte.** `def delete_habit(id: str | None = Query(default=None), date: str | None = Query(default=None), user: User = Depends(get_current_user), db: Session = Depends(get_db))`.

**Objectif.** Désactivation logique, pas suppression physique.

**Paramètres.** `id` obligatoire métier ; `date` facultatif pour le tracker retourné.

**DB.** Sélectionne l'habitude de l'utilisateur. Exécute un `UPDATE RoutineBlock SET active=false` pour ses blocs, met `existing.active=False`, flush, puis recharge le tracker.

**Réponse.** La forme complète de `GET /api/habits`; l'habitude désactivée n'apparaît plus car la lecture filtre `Habit.active is True`.

**Erreurs.** `400 Missing habit id`; `404 Habit not found`; `401`; `500`.

```bash
curl -b cookies.txt -X DELETE "http://127.0.0.1:8000/api/habits?id=clz8abc3q4m7x9k2p6r0t5v3&date=2026-07-31"
```

## 7. Historique et terminal de vie

### 7.1 `GET /api/history`

**Signature réelle.**

```python
def get_history(
    filter: Literal["last7", "last30", "week", "all"] = Query(default="last30"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
```

**Lecture syntaxique.** `Literal[...]` n'accepte que quatre chaînes. Une cinquième valeur est rejetée par FastAPI avant l'appel. `filter` masque le nom de la fonction Python intégrée `filter` dans cette portée, mais le code n'utilise pas cette fonction intégrée.

**Objectif et entrée.** Lire les journaux selon `filter`. `last30` est la valeur par défaut ; `last7` construit sept dates ; `week` construit les dates de la semaine ISO courante ; `all` n'applique aucune liste de dates.

**Ordre et DB.** Les dépendances authentifient l'utilisateur et ouvrent la session. `get_history_data(db,user.id,filter)` sélectionne `DailyLog` du seul utilisateur, éventuellement avec `date IN (...)`, trie par date décroissante, sérialise un résumé de chaque ligne, puis appelle `compute_weekly_summary` pour la semaine courante.

**Réponse réaliste.**

```json
{
  "filter": "last7",
  "visibleDates": [
    "2026-08-01", "2026-07-31", "2026-07-30",
    "2026-07-29", "2026-07-28", "2026-07-27", "2026-07-26"
  ],
  "logs": [{
    "date": "2026-07-31",
    "status": "submitted",
    "updatedAt": "2026-07-31T21:42:00",
    "energy": 70,
    "productivity": 65,
    "executionScore": 68,
    "stateScore": 71,
    "riskScore": 34
  }],
  "weeklySummary": {
    "weekId": "2026-W31",
    "submittedLogs": 1,
    "missingDays": 0
  }
}
```

Le contenu exact de `weeklySummary` comporte d'autres champs calculés par `core.metrics`; l'enveloppe et les champs de `logs` ci-dessus viennent directement du code. Les nombres illustrent une base possible, pas des constantes.

**Erreurs exactes.** `422` si `filter` n'est pas une des quatre valeurs ; `401 Unauthorized` si le cookie échoue ; `500` pour une erreur DB/calcul. Le `ValueError("Unsupported history filter")` du core ne peut normalement pas être atteint par HTTP car `Literal` filtre déjà l'entrée.

```bash
curl -b cookies.txt "http://127.0.0.1:8000/api/history?filter=last7"
```

### 7.2 `GET /api/life-terminal`

**Signature réelle.**

```python
def life_terminal(
    date: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
```

**Objectif.** Construire le read model le plus riche de l'application, pour un tableau de bord agrégé.

**Entrée.** Query `date` facultative ; la route transmet `date or to_date_key()`.

**Ordre et DB.** `get_life_terminal_data` traverse plusieurs sources : journaux récents, tâches du jour et de la semaine, événements, prochain événement fort, métriques hebdomadaires, régime, allocations de temps et export hebdomadaire. Il ne crée pas une table « terminal » : il assemble un dictionnaire en mémoire à partir de tables existantes.

**Réponse : clés racines exactes.**

```json
{
  "today": "2026-08-01",
  "weekId": "2026-W31",
  "terminalHeader": {
    "date": "2026-08-01",
    "weekId": "2026-W31",
    "regime": "stable",
    "phase": "normal_week",
    "dailyLogStatus": "missing",
    "nextHighImpactEvent": null,
    "dataQuality": "missing",
    "risk": "unknown"
  },
  "lifeTape": {"items": [], "calendarPressureLabel": "low"},
  "regime": {},
  "quant": {"projection": {}, "transitionMatrix": {}},
  "calendarContext": {},
  "trajectory": [],
  "enoughForTrend": false,
  "initialEvents": [],
  "taskSections": {},
  "taskMetrics": {},
  "timeAllocation": {},
  "quickLog": {},
  "weeklyPlanner": {},
  "dataQuality": {},
  "weeklySummary": {},
  "interpretation": []
}
```

Les objets vides représentent ici un jeu de données illustratif abrégé, pas une promesse qu'ils sont vides en production. Le code garantit les clés racines listées. Il enrichit notamment `calendarContext` avec `nextHighImpactEvent` et `pressureLevel`; `taskMetrics` avec `today`, `week`, `plannedVsDone`; `dataQuality` avec les nombres de logs, jours manquants, événements et tâches.

**Erreurs.** `401`; date chaîne invalide pouvant aboutir à `500`; toute requête/calcul interne peut donner le `500` générique. La fonction ne lève aucune `HTTPException` métier explicite.

```bash
curl -b cookies.txt "http://127.0.0.1:8000/api/life-terminal?date=2026-08-01"
```

## 8. Objectifs et planning hebdomadaire

Les quatre routes partagent `/api/objectives`, mais les corps multiplexent trois notions : objectifs hiérarchiques, blocs hebdomadaires et commande de démonstration.

### Forme de données retournée par `get_objectives_data`

Pour comprendre les quatre réponses, retenez ses clés racines exactes :

```json
{
  "weekId": "2026-W31",
  "weekDays": ["2026-07-27", "2026-07-28", "2026-07-29", "2026-07-30", "2026-07-31", "2026-08-01", "2026-08-02"],
  "tree": [],
  "objectives": [],
  "taskOptions": [],
  "weeklyBlocks": [],
  "weeklyDays": [],
  "allocation": {},
  "nextActions": [],
  "stats": {},
  "weekSummary": {},
  "suggestedTemplates": [
    {"title":"Annual direction","horizon":"year","kind":"objective","summary":"The highest-level direction you want the rest of the tree to serve."},
    {"title":"Quarter focus","horizon":"quarter","kind":"objective","summary":"A quarter-level bet that narrows the year into one strategic focus."},
    {"title":"Weekly project","horizon":"week","kind":"project","summary":"A week-level project connected to concrete blocks and tasks."}
  ]
}
```

Ici `[]` et `{}` montrent la forme minimale lorsque les collections calculées sont vides. Pour un objectif réel, `objectives` ajoute à la sérialisation : `linkedTaskIds`, `linkedTasksCount`, `weeklyMinutes`.

### 8.1 `GET /api/objectives`

**Signature.**

```python
def get_objectives(
    week_id: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
```

`week_id` correspond au query JSON/URL `week_id`, pas `weekId`, car aucun alias `Query` n'est déclaré. Défaut : `get_iso_week_id()`.

**DB/appels.** `get_objectives_data` lit objectifs non archivés, tâches, blocs hebdomadaires, événements et construit arbre, allocations et statistiques.

**Réponse.** La forme complète ci-dessus.

**Erreurs.** `401`; `500` sur semaine mal formée ou base. Aucune `404`, car une semaine vide retourne des collections vides.

```bash
curl -b cookies.txt "http://127.0.0.1:8000/api/objectives?week_id=2026-W31"
```

### 8.2 `POST /api/objectives`

**Signature.** `body: ObjectiveCreateRequest`, puis `user` et `db` injectés.

**Branche `bootstrap_demo`.** Retourne directement `bootstrap_objectives_demo(db,user.id,semaine)`. Cette fonction crée un jeu d'objectifs, blocs et liaisons de démonstration selon l'état de la base, puis retourne `get_objectives_data`. Le code de route ne crée pas lui-même de modèle dans cette branche.

```json
{"kind":"bootstrap_demo","weekId":"2026-W31"}
```

**Branche `weekly_block`.** Le validateur exige `date`. `_validate_block_objective` accepte `objectiveId=null`; sinon il vérifie un objectif du même utilisateur et non archivé, sous peine de `400 Invalid objectiveId`. La route crée `WeeklyPlanBlock`, flush, puis renvoie :

```json
{
  "block": {"id":"cm0block2026example000001"},
  "data": {"weekId":"2026-W31","weekDays":[],"tree":[],"objectives":[],"taskOptions":[],"weeklyBlocks":[],"weeklyDays":[],"allocation":{},"nextActions":[],"stats":{},"weekSummary":{},"suggestedTemplates":[]}
}
```

Les sous-collections de `data` sont abrégées dans cet exemple ; la réponse réelle appelle la même fonction décrite plus haut.

Corps réaliste :

```json
{"kind":"weekly_block","date":"2026-07-31","title":"Étudier FastAPI","category":"study","durationMinutes":90,"flexible":false}
```

**Branche objectif normale.** `kind` enum devient `ObjectiveKind`; une valeur de commande autre que les deux branches retombe sur `OBJECTIVE`. `_validate_objective_parent` remonte toute la chaîne des parents : parent absent/archivé/d'un autre utilisateur donne `400 Invalid parentId`; revisiter un id donne `400 Objective hierarchy cannot contain a cycle`. La route choisit un titre par défaut si le titre vide, calcule `weekId` pour l'horizon semaine, crée et flush l'objectif, puis `sync_objective_tasks` affecte les tâches valides demandées.

```json
{"kind":"project","title":"Comprendre l'API Python","horizon":"week","priority":"high","linkedTaskIds":[]}
```

Réponse : un objet `objective` contenant l'id créé et un objet `data` ayant exactement les douze clés racines documentées au début de la section 8.

**Erreurs exactes.** `422 date is required for a weekly block` via Pydantic ; `400 Invalid objectiveId`; `400 Invalid parentId`; `400 Objective hierarchy cannot contain a cycle`; `401`; `500`. Succès `200`.

### 8.3 `PATCH /api/objectives`

**Signature.** `body: ObjectiveUpdateRequest`; `id` obligatoire, puis `user`/`db`.

**Branche bloc.** `kind="weekly_block"`. Sélection de `WeeklyPlanBlock` par `(id,userId)`, sinon `404 Weekly block not found`. `model_fields_set` permet de distinguer « champ absent » et « champ présent avec `null` ». Ainsi un `objectiveId:null`, `startTime:null`, `endTime:null` ou `note:null` efface réellement la valeur. Les autres attributs ne changent que si non `None`. Flush et réponse `{block:{id},data:...}`.

```json
{"id":"cm0block2026example000001","kind":"weekly_block","durationMinutes":120,"note":null}
```

**Branche objectif.** Sélection par `(id,userId)`, sinon `404 Objective not found`. La validation de parent empêche les cycles. `summary`, `nextAction`, `targetDate`, `weekId` peuvent être effacés explicitement grâce à `model_fields_set`. Les enums sont enregistrés par `.value`. Après flush, `linkedTaskIds`, s'il est présent même vide, déclenche `sync_objective_tasks`.

```json
{"id":"cm0objective2026example01","status":"on_track","nextAction":"Lire routers/tasks.py","linkedTaskIds":[]}
```

**Réponse.** Soit les clés `objective` et `data`, soit les clés `block` et `data`. `objective`/`block` contient l'id ; `data` a les douze clés racines documentées au début de la section 8.

**Erreurs.** `404 Weekly block not found`; `404 Objective not found`; les deux erreurs `400` de hiérarchie ; `400 Invalid objectiveId` pour la liaison d'un bloc ; `422` contrat ; `401`; `500`.

### 8.4 `DELETE /api/objectives`

**Signature.**

```python
def delete_objective(
    id: str | None = Query(default=None),
    kind: str = Query(default="objective"),
    week_id: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
```

**Branche bloc.** Seulement la chaîne exacte `kind=weekly_block` sélectionne cette branche. La ligne `WeeklyPlanBlock` est physiquement supprimée, flush, puis les données sont relues.

**Branche objectif.** Toute autre valeur de `kind` arrive ici. L'objectif n'est pas supprimé : les tâches et blocs qui le référencent reçoivent `objectiveId=None`, puis `existing.archived=True`. La route flush et recharge.

**Réponse.** Directement `get_objectives_data`, sans enveloppe `objective` ou `block`.

**Erreurs.** `400 Missing id`; `404 Weekly block not found`; `404 Objective not found`; `401`; `500`.

```bash
curl -b cookies.txt -X DELETE "http://127.0.0.1:8000/api/objectives?id=cm0objective2026example01&kind=objective&week_id=2026-W31"
```

## 9. Rapport hebdomadaire

### 9.1 `GET /api/reports/week`

**Signature.** `week_id: str | None = Query(None)`, `user`, `db`.

**Particularité importante.** Ce `GET` écrit en base. `generate_weekly_report` appelle `build_weekly_json_export`, cherche `WeeklyReport(userId,weekId)`, crée la ligne si absente ou remplace `content`, puis flush. Le commit vient de `get_db`.

**Réponse exacte au niveau racine.**

```json
{
  "week_id": "2026-W31",
  "generated_at": "2026-08-01T10:00:00",
  "period": {"start":"2026-07-27","end":"2026-08-02"},
  "calendar_context": {
    "active_phase":"normal_week",
    "high_impact_events_next_7d":0,
    "expected_stress_load":0,
    "expected_preparation_load":0
  },
  "weekly_summary": {
    "avg_state_score":71,
    "avg_risk_score":34,
    "avg_execution_score":68,
    "avg_start_friction":25,
    "submitted_logs":1,
    "missing_days":0,
    "skipped_days":0,
    "training_days":1
  },
  "days": [],
  "missing_days": [],
  "skipped_days": [],
  "interpretation": []
}
```

Le header `Content-Disposition` vaut `attachment; filename="life-regime-2026-W31.json"` pour cette semaine.

**Erreurs.** `401`; `500` génération/DB. Aucun contrôle Pydantic du format de `week_id` car il est annoté simple `str`.

```bash
curl -b cookies.txt -OJ "http://127.0.0.1:8000/api/reports/week?week_id=2026-W31"
```

## 10. Réglages

### 10.1 `GET /api/settings`

**Signature.** `def get_settings_route(user: User = Depends(get_current_user))`.

**Ordre.** Il n'y a pas de paramètre `db` explicite dans la route, mais `get_current_user` a déjà utilisé `get_db` pour charger le modèle `User`. `_settings_payload` lit les attributs de cet objet.

**Réponse.**

```json
{"settings":{"calorieTarget":2200,"defaultSleepDelayMin":20,"theme":"dark"}}
```

`theme` est codé en dur à `dark`; ce n'est pas une colonne lue.

**Erreurs.** `401`; erreur DB d'authentification `500`.

### 10.2 `PATCH /api/settings`

**Signature.** `body: SettingsUpdateRequest`, `user`, `db`.

**Ordre.** Pour chaque champ non `None`, affecte le modèle `User`. `db.add(user)` réattache/assure le suivi de l'objet, `flush` émet l'UPDATE, la réponse relit l'objet. Le commit est ultérieur.

**Corps.**

```json
{"calorieTarget":2400,"defaultSleepDelayMin":30}
```

**Réponse.**

```json
{"settings":{"calorieTarget":2400,"defaultSleepDelayMin":30,"theme":"dark"}}
```

**Erreurs.** `422` hors 0–20 000 ou 0–1 440 ; `401`; `500`.

## 11. Tâches

### Forme sérialisée

```json
{
  "id":"cm0task2026example00000001",
  "userId":"cm0user2026example00000001",
  "title":"Lire le routeur tasks",
  "date":"2026-08-01",
  "importance":"high",
  "productive":true,
  "estimatedMinutes":45,
  "completionPercent":0,
  "status":"planned",
  "objectiveId":null,
  "objectiveTitle":null,
  "createdAt":"2026-08-01T09:00:00",
  "updatedAt":"2026-08-01T09:00:00"
}
```

### 11.1 `GET /api/tasks`

**Signature.** `scope: str = Query("today")`, `date: str|None`, `user`, `db`.

**Règles exactes.** Si `scope == "tomorrow"`, la date est demain et un paramètre `date` éventuel est ignoré. Sinon la date est `date` ou aujourd'hui. Si `scope == "all"`, aucun filtre de date n'est ajouté. Toute autre chaîne agit comme une vue d'un seul jour ; `scope` n'est pas un `Literal`.

**DB.** Construit `select(Task,Objective.title)` avec `outerjoin` limité à l'utilisateur, filtre `Task.userId`, puis éventuellement `Task.date`. Tri : date croissante, statut croissant, importance décroissante, création croissante. Le titre déjà joint évite une requête supplémentaire ; `serialize_task` peut sinon faire `db.get(Objective,...)`.

**Réponse.** La clé `tasks` contient une liste d'objets ayant exactement les treize champs de la forme sérialisée présentée juste avant.

**Erreurs.** `401`; date non parsable `500`; DB `500`. Aucun `404` pour liste vide.

```bash
curl -b cookies.txt "http://127.0.0.1:8000/api/tasks?scope=today&date=2026-08-01"
```

### 11.2 `POST /api/tasks`

**Signature.** `body: TaskCreateRequest`, `user`, `db`.

**Choix des titres.** Si `body.titles` est une liste non vide, chaque chaîne est `strip()`; sinon la route utilise `body.title` ou `Untitled task`. Une seconde compréhension retire les chaînes vides. Une liste comme `["  "]` aboutit donc à zéro tâche, sans erreur.

**Validation métier.** `_validate_objective_access` ne fait rien pour `null`; sinon sélectionne `Objective` par `(id,userId)`. Il ne filtre pas `archived`. Absence : `400 Invalid objectiveId`.

**DB.** Pour chaque titre, crée `Task`, `add`; un seul flush pour toute la liste ; recalcule les scores autour de la date ; sérialise.

**Corps de création multiple.**

```json
{"titles":["Lire tasks.py","Tester POST /api/tasks"],"date":"2026-08-01","importance":"high","estimatedMinutes":45}
```

**Réponse.** `task` répète le premier élément pour compatibilité, `tasks` contient tous les éléments :

```json
{"task":{"id":"cm0task2026example00000001","title":"Lire tasks.py","date":"2026-08-01"},"tasks":[{"id":"cm0task2026example00000001","title":"Lire tasks.py","date":"2026-08-01"},{"id":"cm0task2026example00000002","title":"Tester POST /api/tasks","date":"2026-08-01"}]}
```

Chaque objet réel contient tous les champs de la forme sérialisée. Pour zéro titre, réponse exacte logique : `{"task":null,"tasks":[]}`.

**Erreurs.** `400 Invalid objectiveId`; `422` validation ; `401`; `500`. Succès `200`.

### 11.3 `PATCH /api/tasks`

**Signature.** `body: TaskUpdateRequest`, `user`, `db`.

**DB.** Sélection par `(id,userId)`, sinon `404`. `model_fields_set` est utilisé seulement pour `objective_id`, afin que JSON `"objectiveId":null` détache l'objectif tandis qu'un champ absent ne change rien. Les autres champs changent seulement si non `None`. Flush, puis `recompute_around_date` sur la date finale.

**Corps.**

```json
{"id":"cm0task2026example00000001","completionPercent":100,"status":"done","objectiveId":null}
```

**Réponse.** La clé `task` contient l'objet sérialisé complet de treize champs présenté au début de la section 11.

**Erreurs.** `404 Task not found`; `400 Invalid objectiveId`; `422`; `401`; `500`.

Il n'existe pas de route de suppression de tâche dans ce routeur.

## 12. Allocation du temps

### Forme de lecture

`get_time_allocation_data` renvoie exactement les clés racines suivantes :

```json
{
  "date":"2026-08-01",
  "weekId":"2026-W31",
  "dayBudgetMinutes":720,
  "targetWeightTotal":100,
  "plannedMinutesTotal":720,
  "plannedMinutesAutoTotal":720,
  "actualMinutesTotal":0,
  "weekActualMinutesTotal":0,
  "remainingBudgetMinutes":0,
  "overBudgetMinutes":0,
  "hasManualPlanOverrides":false,
  "rows":[],
  "metrics":{"targetReturn":0,"actualReturn":0,"targetRisk":0,"actualRisk":0,"beta":0,"capmExpectedReturn":20,"sharpeLike":0}
}
```

Chaque ligne `rows` contient id, nom, objectif, poids cible/réel/semaine, minutes planifiées/automatiques/stockées/réelles/semaine, flag manuel, rendement, risque, bêta, couleur et actif.

### 12.1 `GET /api/time-allocation`

**Signature.** `date: str|None = Query(None)`, `user`, `db`.

**DB.** Le core lit catégories actives, allocations du jour, allocations de la semaine et budget journalier. Il distribue automatiquement le budget selon les poids, calcule totaux et métriques de portefeuille.

**Réponse.** Forme ci-dessus.

**Erreurs.** `401`; date invalide/DB `500`.

### 12.2 `POST /api/time-allocation`

**Objectif.** Créer seulement une catégorie, pas encore une allocation quotidienne.

**Signature.** `body: TimeAllocationCategoryCreateRequest`, `user`, `db`.

**DB.** Construit `TimeAllocationCategory`, `add`, `flush`, puis `serialize_category`.

**Corps.**

```json
{"name":"Études","objective":"Maîtriser Python","targetWeight":40,"expectedReturn":80,"risk":30,"beta":1.2,"color":"#22d3ee"}
```

**Réponse.**

```json
{"category":{"id":"cm0category2026example001","userId":"cm0user2026example00000001","name":"Études","objective":"Maîtriser Python","targetWeight":40,"expectedReturn":80,"risk":30,"beta":1.2,"color":"#22d3ee","active":true,"createdAt":"2026-08-01T10:00:00","updatedAt":"2026-08-01T10:00:00"}}
```

**Erreurs.** `422`; `401`; `500`; succès `200`.

### 12.3 `PATCH /api/time-allocation`

**Signature exacte.** `def update_time_allocation(body: TimeAllocationUpdateRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db))`. Les quatre branches décrites ci-dessous sont des `if` dans cette unique fonction, pas quatre endpoints.

**Branche `day_budget`.** Date du corps ou aujourd'hui. `upsert_day_budget` fait un upsert de `DailyPlanningContext`. Si `dayBudgetMinutes` est absent, la route impose `12*60`, soit 720. Retourne la lecture complète.

```json
{"kind":"day_budget","date":"2026-08-01","dayBudgetMinutes":600}
```

**Branche `allocation`.** Le validateur exige `categoryId`. La route vérifie la catégorie par `(id,userId)`, sinon `400 Invalid categoryId`. `upsert_daily_allocation` insère/met à jour les valeurs non `None` pour `(userId,categoryId,date)`. Retourne la lecture complète.

```json
{"kind":"allocation","categoryId":"cm0category2026example001","date":"2026-08-01","plannedMinutes":240,"plannedMinutesManual":true,"actualMinutes":90,"note":"Lecture et exercices"}
```

**Branche `portfolio`.** Le validateur exige `name` non vide même si `id` désigne une catégorie existante. Avec `id`, sélectionne ou `404`, puis `_update_category`; sans `id`, crée une catégorie. Dans les deux cas, upsert ensuite l'allocation quotidienne et retourne la lecture complète. Point de code : lors d'une création, `target_weight=body.target_weight or 0`; une valeur zéro reste donc zéro, et les autres défauts sont 50/50/1 si `None`.

```json
{"kind":"portfolio","name":"Études","targetWeight":40,"date":"2026-08-01","plannedMinutes":240,"actualMinutes":90}
```

**Branche catégorie normale.** Quand `kind` est `null`/absent, le validateur exige `id`. Sélection ou `404`, affectation des champs non `None`, flush, réponse `{category:...}`.

```json
{"id":"cm0category2026example001","risk":25,"active":true}
```

**Erreurs exactes.** `422 categoryId is required for an allocation update`; `422 name is required for a portfolio update`; `422 id is required for a category update`; `400 Invalid categoryId`; `404 Allocation category not found`; `401`; `500`.

### 12.4 `DELETE /api/time-allocation`

**Objectif.** Désactiver logiquement une catégorie.

**Signature.** `id: str|None`, `date: str|None`, `user`, `db`.

**DB.** Sans id : `400`. Sélection par `(id,userId)`, sinon `404`. Affecte `active=False`, flush, recharge les données pour la date. Les allocations historiques ne sont pas supprimées.

**Réponse.** Forme complète de lecture, sans la catégorie puisque le core filtre les catégories actives.

**Erreurs.** `400 Missing category id`; `404 Allocation category not found`; `401`; `500`.

```bash
curl -b cookies.txt -X DELETE "http://127.0.0.1:8000/api/time-allocation?id=cm0category2026example001&date=2026-08-01"
```

## 13. Transcription : passerelle de l'API principale

### 13.1 `POST /api/transcribe`

**Signature réelle.**

```python
async def transcribe(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
```

**Entrée.** `multipart/form-data`, champ obligatoire `file`. Aucun JSON. Le cookie est obligatoire. Les types admis sont tout `audio/*`, `application/octet-stream` et `video/webm`.

**Ordre exact.** Après auth, `get_settings`. Refus du type. `await file.read(max_audio_bytes+1)` lit un octet de plus que la limite pour détecter le dépassement sans accepter un fichier trop grand ; `await file.close()`. Construit le tuple multipart `(filename,bytes,content-type)`. Crée `httpx.Timeout`, entre dans `AsyncClient`, puis `await client.post(whisper_service_url,files=files)`.

Si le service répond avec statut >=400, la route tente son JSON et prend `detail` ou `error`; sinon son texte. Elle relance toujours cela comme `502`. Pour un succès, elle exige un JSON et retourne seulement `text`; le champ `language` du microservice est volontairement supprimé.

**Réponse.**

```json
{"text":"Ceci est une transcription de test."}
```

**Erreurs exactes.**

- `415 Unsupported audio type` ;
- `413 Audio file is too large` ;
- `503 Whisper service is unavailable` sur `httpx.ConnectError` ;
- `503 Whisper request failed` sur autre `httpx.HTTPError` ;
- `502` avec message amont si statut amont >=400 ;
- `502 Whisper returned invalid JSON` ;
- `422` si fichier absent ;
- `401` ;
- `500` inattendu.

```bash
curl -b cookies.txt -X POST http://127.0.0.1:8000/api/transcribe \
  -F "file=@sample.webm;type=video/webm"
```

## 14. Routes du service Whisper séparé

Ces URLs vivent sur le processus/port du service, pas sous `/api`. Elles n'utilisent ni cookie, ni PostgreSQL, ni les gestionnaires d'erreur de `main.py`.

### 14.1 `GET /health`

**Signature.** `def health(): return {"ok":True}`.

**Entrée/DB.** Aucune ; pas de chargement du modèle Whisper. Un résultat vrai prouve seulement que FastAPI répond.

**Réponse.** `200 {"ok":true}`.

```bash
curl http://127.0.0.1:8001/health
```

### 14.2 `POST /transcribe`

**Signature.** `async def transcribe(file: UploadFile = File(...))`.

**Entrée.** Même règle de types et limite `MAX_AUDIO_BYTES`, lue au démarrage depuis l'environnement avec défaut 25 MiB.

**Ordre exact.** Lit puis ferme le fichier. `ensure_ffmpeg_on_path` trouve le binaire fourni par `imageio_ffmpeg`; si son nom n'est pas `ffmpeg.exe`, il crée un shim dans `.runtime/ffmpeg`, puis ajoute le répertoire au `PATH`. Le suffixe du nom de fichier devient celui du temporaire, avec `.mp3` par défaut. `NamedTemporaryFile(delete=False)` écrit les octets et se ferme avant Whisper.

Avant le sémaphore, `transcription_slots.locked()` provoque `429` si une transcription détient déjà l'unique slot. `async with transcription_slots` acquiert/libère le slot. `await run_in_threadpool(load_model)` charge le modèle hors de l'event loop ; `@lru_cache(maxsize=1)` garde ensuite un seul modèle. `await run_in_threadpool(model.transcribe,str(temp_path))` effectue le calcul bloquant hors boucle.

Le `finally` tente toujours `temp_path.unlink(missing_ok=True)`; une erreur de suppression `OSError` est volontairement ignorée.

**Réponse complète.**

```json
{"text":"Ceci est une transcription de test.","language":"fr"}
```

**Erreurs exactes, forme FastAPI standard `{detail:...}`.**

- `415 Unsupported audio type` ;
- `413 Audio file is too large` ;
- `429 Transcription service is busy` ;
- `422 Audio could not be transcribed` si Whisper lève `RuntimeError` ;
- `500 Whisper transcription failed` pour autre exception ;
- `422` fichier absent/multipart invalide.

```bash
curl -X POST http://127.0.0.1:8001/transcribe \
  -F "file=@sample.webm;type=video/webm"
```

## 15. Matrice des erreurs déclarées

| Message exact | Statut | Routes |
|---|---:|---|
| `Unauthorized` | 401 | toutes les routes protégées |
| `Invalid access key` | 401 | login |
| `Missing event id` | 400 | delete événement |
| `Event not found` | 404 | patch/delete événement |
| `Event end must be after its start` | 422 | patch événement |
| `Invalid daily-log status range` | 400 | statuts journal |
| `Invalid habitId` | 400 | check-in habitude |
| `Habit not found` | 404 | patch/delete habitude |
| `Missing habit id` | 400 | delete habitude |
| `Invalid parentId` | 400 | objectif parent |
| `Objective hierarchy cannot contain a cycle` | 400 | objectif parent |
| `Invalid objectiveId` | 400 | blocs/tâches |
| `Weekly block not found` | 404 | patch/delete bloc |
| `Objective not found` | 404 | patch/delete objectif |
| `Missing id` | 400 | delete objectif |
| `Task not found` | 404 | patch tâche |
| `Invalid categoryId` | 400 | allocation |
| `Allocation category not found` | 404 | patch/delete allocation |
| `Missing category id` | 400 | delete allocation |
| `Unsupported audio type` | 415 | les deux transcriptions |
| `Audio file is too large` | 413 | les deux transcriptions |
| `Whisper service is unavailable` | 503 | passerelle |
| `Whisper request failed` | 503 | passerelle |
| `Transcription failed` ou message amont | 502 | passerelle |
| `Whisper returned invalid JSON` | 502 | passerelle |
| `Transcription service is busy` | 429 | microservice |
| `Audio could not be transcribed` | 422 | microservice |
| `Whisper transcription failed` | 500 | microservice |

## 16. Exercice de traçage corrigé

### Énoncé

Un client authentifié envoie :

```json
{"id":"cm0task2026example00000001","objectiveId":null,"completionPercent":120}
```

à `PATCH /api/tasks`. La tâche existe. La base est-elle lue ? L'objectif est-il détaché ?

### Correction

Non aux deux questions. Pydantic essaie d'abord de construire `TaskUpdateRequest`. `completionPercent` dépasse `le=100`, donc il produit `RequestValidationError`. FastAPI n'appelle pas la fonction `update_task`; par conséquent sa sélection SQL et son affectation `objectiveId=None` n'ont jamais lieu. Le gestionnaire de `main.py` renvoie `422` et `details`. L'authentification et ses dépendances peuvent être résolues dans l'orchestration FastAPI, mais il ne faut jamais compter sur la route ni sur une écriture quand la validation du corps échoue.
