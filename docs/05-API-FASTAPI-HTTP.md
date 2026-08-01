# API FastAPI et HTTP

## Rôle du backend

Le backend Python reçoit les requêtes, vérifie leur format et la session, applique les règles métier, lit ou modifie PostgreSQL, puis retourne du JSON.

Technologies :

- **FastAPI 0.139.0** : routes HTTP, injection de dépendances et documentation OpenAPI ;
- **Pydantic 2.13.4** : validation des corps JSON et conversion `camelCase` → `snake_case` ;
- **SQLAlchemy 2.0.51** : requêtes et transactions PostgreSQL ;
- **psycopg2 2.9.12** : pilote PostgreSQL utilisé par SQLAlchemy ;
- **httpx 0.28.1** : appel asynchrone borné au service Whisper ;
- **Uvicorn 0.51.0** : serveur qui exécute l’application FastAPI.

Le code se trouve dans `interface_API/app/`.

## Cycle d’une requête

```text
requête HTTP
→ validation Pydantic et paramètres de query
→ dépendance get_current_user
→ routeur
→ fonction core ou requête SQLAlchemy
→ commit ou rollback de get_db
→ sérialisation JSON
→ réponse HTTP
```

`get_db()` ouvre une session. Si tout réussit, la session est commitée. Si une exception remonte, elle est rollbackée. Elle est toujours fermée à la fin.

## Exemple FastAPI minimal, basé sur le projet

```python
from fastapi import FastAPI

app = FastAPI()

@app.get("/api/health")
def health_check():
    return {"ok": True}
```

Explication ligne par ligne :

1. `from fastapi import FastAPI` importe la classe qui crée l’application web.
2. La ligne vide sépare l’import de l’initialisation.
3. `app = FastAPI()` construit l’objet application que le serveur exécutera.
4. La ligne vide sépare l’initialisation de la route.
5. `@app.get("/api/health")` associe la méthode HTTP `GET` et le chemin `/api/health` à la fonction suivante.
6. `def health_check():` déclare la fonction appelée pour cette route. Elle ne reçoit ici aucun paramètre.
7. `return {"ok": True}` renvoie un dictionnaire Python ; FastAPI le transforme en JSON `{"ok": true}`.

Erreurs fréquentes : oublier `@` empêche de déclarer le décorateur ; utiliser `true` au lieu de `True` est invalide en Python ; définir deux fois la même combinaison méthode/chemin rend le comportement ambigu. Dans le vrai projet, la route `health()` inclut aussi `usingDevAccessKey`.

## Méthodes HTTP

| Méthode | Intention dans ce projet |
| --- | --- |
| `GET` | Lire sans modifier intentionnellement les données |
| `POST` | Créer ou effectuer un upsert/une commande |
| `PATCH` | Modifier une partie d’une ressource existante |
| `DELETE` | Supprimer ou désactiver/archiver selon le contrat |

`PATCH` distingue un champ absent d’un champ présent avec `null`. Les routeurs utilisent `model_fields_set` lorsque cette différence est importante.

## Routes complètes

Sauf mention contraire, les routes exigent le cookie `life_regime_session` valide.

### Système et authentification

| Méthode et chemin | Entrée | Rôle | Authentification |
| --- | --- | --- | --- |
| `GET /api/health` | aucune | État minimal de l’API et indicateur de clé de développement | publique |
| `POST /api/auth/login` | JSON `{accessKey}` | Vérifie la clé, assure l’utilisateur local et crée le cookie | publique |
| `POST /api/auth/logout` | aucune | Supprime le cookie | pas de session valide requise |

Le navigateur utilise actuellement les équivalents Next.js sous `app/api/auth/`. Les endpoints FastAPI permettent aussi un accès direct compatible.

### Journal quotidien

| Méthode et chemin | Entrée principale | Résultat |
| --- | --- | --- |
| `GET /api/daily-log/statuses?from=YYYY-MM-DD&to=YYYY-MM-DD` | plage obligatoire, maximum 70 jours | statut de chaque date de la plage |
| `GET /api/daily-log?date=YYYY-MM-DD` | date optionnelle, aujourd’hui par défaut | journal et données de contexte |
| `POST /api/daily-log` | `DailyLogUpsertRequest` | crée/met à jour le journal et recalcule les scores voisins |

Les scores reçus du client ne sont pas la source de vérité : le backend recalcule exécution, état, risque, variation, accélération et régime.

### Tâches

| Méthode et chemin | Entrée principale | Résultat |
| --- | --- | --- |
| `GET /api/tasks?scope=today|tomorrow|all&date=...` | scope et date optionnels | liste triée de tâches |
| `POST /api/tasks` | un `title` ou plusieurs `titles`, plus les champs de tâche | tâche(s) créée(s) |
| `PATCH /api/tasks` | `id` obligatoire et champs partiels | tâche mise à jour |

Si `objectiveId` est fourni, la route vérifie que l’objectif appartient bien à l’utilisateur courant.

### Événements du calendrier

| Méthode et chemin | Entrée principale | Résultat |
| --- | --- | --- |
| `GET /api/calendar-events?from=...&to=...` | bornes optionnelles | événements de la période |
| `POST /api/calendar-events` | titre, type, début, fin, impact et charges | événement créé |
| `PATCH /api/calendar-events` | `id` et champs partiels | événement mis à jour |
| `DELETE /api/calendar-events?id=...` | identifiant obligatoire | suppression de l’événement |

Les dates d’événement sont des date-heures ISO. Les conversions UTC sont centralisées dans `core/dates.py`.

### Habitudes

| Méthode et chemin | Entrée principale | Résultat |
| --- | --- | --- |
| `GET /api/habits?date=YYYY-MM-DD` | date optionnelle | tracker des habitudes et routine du jour |
| `POST /api/habits` | définition d’une habitude | habitude créée |
| `PATCH /api/habits` | commande de modification ou check-in | tracker actualisé |
| `DELETE /api/habits?id=...&date=...` | id obligatoire | désactivation et tracker actualisé |

Une suppression d’habitude est logique : le champ `active` passe à faux.

### Objectifs et planning

| Méthode et chemin | Entrée principale | Résultat |
| --- | --- | --- |
| `GET /api/objectives?week_id=YYYY-Www` | semaine ISO optionnelle | arbre, tâches liées et planning |
| `POST /api/objectives` | objectif, bloc hebdomadaire ou commande `bootstrap_demo` | ressource créée et read model actualisé |
| `PATCH /api/objectives` | `id`, type et champs partiels | objectif ou bloc actualisé |
| `DELETE /api/objectives?id=...&kind=...&week_id=...` | id obligatoire | objectif archivé ou bloc supprimé |

Le routeur vérifie l’ownership, l’existence du parent et l’absence de cycle dans l’arbre. Supprimer un objectif l’archive et détache ses tâches/blocs au lieu de supprimer ces enregistrements.

### Paramètres et allocation du temps

| Méthode et chemin | Entrée principale | Résultat |
| --- | --- | --- |
| `GET /api/settings` | aucune | préférences de l’utilisateur |
| `PATCH /api/settings` | calories et délai de sommeil optionnels | préférences mises à jour |
| `GET /api/time-allocation?date=YYYY-MM-DD` | date optionnelle | budget, catégories, allocations et métriques |
| `POST /api/time-allocation` | définition de catégorie | catégorie créée |
| `PATCH /api/time-allocation` | commande `day_budget`, `allocation`, `portfolio` ou catégorie | read model ou catégorie actualisé |
| `DELETE /api/time-allocation?id=...&date=...` | id obligatoire | catégorie désactivée et read model actualisé |

Les allocations utilisent des upserts pour éviter le schéma fragile « lire puis insérer » en cas de concurrence.

### Read models et rapports

| Méthode et chemin | Entrée principale | Résultat |
| --- | --- | --- |
| `GET /api/history?filter=last7|last30|week|all` | filtre optionnel, `last30` par défaut | dates visibles, journaux et résumé hebdomadaire |
| `GET /api/life-terminal?date=YYYY-MM-DD` | date optionnelle | agrégat du terminal de vie |
| `GET /api/reports/week?week_id=YYYY-Www` | semaine optionnelle | export JSON téléchargeable |

`history` et `life-terminal` sont des read models : ils combinent plusieurs tables pour fournir exactement les données utiles à un écran. Les pages serveur les appellent directement avec `requestInternalApiJson`.

### Transcription

| Méthode et chemin | Entrée principale | Résultat |
| --- | --- | --- |
| `POST /api/transcribe` | `multipart/form-data`, champ `file` | JSON `{text}` |

La route accepte `audio/*`, `video/webm` et `application/octet-stream`, impose `MAX_AUDIO_BYTES`, puis appelle `WHISPER_SERVICE_URL` avec `WHISPER_TIMEOUT_SECONDS`.

## Query, corps et cookie

- Une **query string** suit `?`, par exemple `?date=2026-07-31`.
- Un **corps JSON** transporte une structure lors d’un `POST` ou `PATCH`.
- Un **cookie** est un en-tête géré par le navigateur ; ici il porte la session signée.
- Un upload audio utilise `multipart/form-data`, pas JSON.

## Validation Pydantic

`contracts/common.py` définit `ApiRequest` :

- le JSON peut utiliser `camelCase` ;
- le code Python manipule `snake_case` ;
- `populate_by_name=True` autorise aussi les noms Python ;
- les champs supplémentaires sont actuellement ignorés avec `extra="ignore"`.

Les contrats imposent des bornes. Exemple : `completionPercent` reste entre 0 et 100 et `workTimeMinutes` entre 0 et 1440. Une valeur invalide produit une réponse `422` avant l’écriture en base.

## Réponses d’erreur

Les gestionnaires de `main.py` stabilisent la forme publique :

- erreur métier/HTTP : `{ "error": "message" }` ;
- validation : `{ "error": "Request validation failed", "details": [...] }` ;
- exception imprévue : `{ "error": "Internal server error" }`.

Codes courants :

| Code | Signification dans le projet |
| --- | --- |
| `200` | succès |
| `400` | commande incohérente ou identifiant requis absent |
| `401` | session absente ou invalide |
| `404` | ressource inexistante ou inaccessible à cet utilisateur |
| `413` | fichier audio trop volumineux |
| `415` | type audio non accepté |
| `422` | données refusées par Pydantic |
| `502` | Whisper a répondu de manière invalide ou en erreur |
| `503` | service API ou Whisper indisponible |
| `500` | exception interne non prévue |

Ne renvoyez pas le texte brut d’une exception interne au client. Il peut exposer la structure de la base, un chemin local ou un secret.

## Ajouter une route API proprement

1. Définir ou étendre le modèle Prisma si une donnée persistante change.
2. Créer la migration Prisma et aligner `models.py`.
3. Ajouter le contrat Pydantic dans `contracts/<domaine>.py`.
4. Mettre le calcul réutilisable dans `core/<domaine>.py`.
5. Ajouter une fonction courte dans `routers/<domaine>.py`.
6. Injecter `get_current_user` et `get_db` si la route est privée et persistante.
7. Vérifier l’ownership de chaque ressource référencée.
8. Inclure un nouveau routeur dans `main.py` si nécessaire.
9. Ajouter le proxy Next uniquement pour un appel navigateur.
10. Ajouter/adapter le module `features/<domaine>/api` et son parseur.
11. Tester les succès, entrées invalides, accès non authentifié, ownership et transaction.
12. Exécuter `pnpm check`.

## Documentation interactive

Quand FastAPI fonctionne, OpenAPI est disponible à `http://127.0.0.1:8000/docs`. Cette page aide à inspecter les schémas réels. Elle ne remplace pas cette documentation d’architecture et ne fournit pas automatiquement un cookie valide.
