# Laboratoire HTTP — expérimenter sans toucher à la base réelle

## But et règle de sécurité

Ce laboratoire transforme la lecture en pratique. Il couvre le routage, l'authentification, la validation `422`, plusieurs opérations CRUD, le cycle commit/rollback et la passerelle audio.

Les expériences sont conçues pour ne pas modifier la base réelle :

- les commandes `curl.exe` sont en lecture seule ou volontairement rejetées avant une écriture ;
- les tests avec état remplacent `get_current_user` et `get_db` avec `app.dependency_overrides` ;
- les appels Whisper sont remplacés par un faux client HTTP local ;
- les objets créés vivent seulement en mémoire pendant le test ;
- chaque test nettoie ses overrides et patches.

Ne lancez pas un exemple d'écriture `curl` sur une base qui contient vos données personnelles. Les écritures de ce chapitre passent par `TestClient` et des doubles de test.

## 1. Préparation

Placez-vous dans le dossier de l'API :

```powershell
Set-Location H:\CYTECHDATA\Documents\interface\interface_API
```

Vérifiez les dépendances déjà prévues par le dépôt :

```powershell
python -m unittest tests.test_contracts tests.test_security tests.test_api_boundaries
```

Cette commande utilise trois fichiers existants. Elle n'écrit pas dans la base : les tests de contrats construisent des modèles en mémoire, les tests de sécurité signent/décodent des chaînes, et les tests de frontière appellent seulement la santé et une transcription non authentifiée.

Résultat attendu : une suite terminée par `OK`. Si l'import échoue, vérifiez que l'environnement Python contient les versions de `requirements.txt` et que la commande est exécutée depuis `interface_API`.

## 2. Protocole pédagogique : prédire avant d'exécuter

Pour chaque exercice :

1. cachez la correction ;
2. écrivez le statut HTTP attendu ;
3. écrivez les clés JSON attendues ;
4. dites si la fonction de route sera appelée ;
5. dites si une session DB sera ouverte ;
6. exécutez seulement ensuite ;
7. comparez la différence entre prédiction et observation.

Une bonne prédiction n'exige pas de deviner un identifiant ou un timestamp. Elle doit identifier la structure, le chemin d'exécution et les effets.

## 3. Exercice 1 — health check avec `curl.exe`

### Prédiction

Avant d'exécuter, répondez :

- faut-il un cookie ?
- PostgreSQL sera-t-il interrogé ?
- quelles sont les deux clés du JSON ?
- `usingDevAccessKey=true` signifie-t-il que Whisper fonctionne ?

### Commande

Démarrez l'API dans un premier terminal si elle ne tourne pas :

```powershell
python run.py
```

Puis, dans un second terminal :

```powershell
curl.exe -i http://127.0.0.1:8000/api/health
```

Sous PowerShell, utilisez `curl.exe` explicitement : selon la version, `curl` peut être un alias PowerShell différent du programme curl.

### Observation attendue

```http
HTTP/1.1 200 OK
content-type: application/json

{"ok":true,"usingDevAccessKey":true}
```

La seconde valeur peut être `false` si `APP_ACCESS_KEY` est configurée.

### Correction détaillée

Le décorateur `@app.get("/api/health")` a enregistré une route publique. Sa signature n'a ni `Depends(get_current_user)` ni `Depends(get_db)`. La route appelle seulement `get_settings().is_using_dev_access_key`. Elle ne teste ni la base ni Whisper.

Le statut est `200` car aucun autre `status_code` n'est déclaré. FastAPI transforme le dictionnaire Python en JSON.

## 4. Exercice 2 — connexion refusée sans risque

### Prédiction

Choisissez volontairement une chaîne qui ne correspond pas à la clé. Prédisez le statut, le corps, la présence d'un cookie de session et l'utilisation du gestionnaire global `HTTPException`.

### Commande

```powershell
curl.exe -i -X POST http://127.0.0.1:8000/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{"accessKey":"definitely-not-the-configured-key"}'
```

### Correction

La réponse attendue est :

```json
{"error":"Invalid access key"}
```

avec `401`. La route utilise directement `JSONResponse`, elle ne lève pas `HTTPException`; le handler global n'est donc pas responsable de cette forme. `set_session_cookie` n'est appelé que dans la branche de succès, donc aucun cookie valide n'est créé.

`get_db` ouvre bien une session, car `login` la demande. `authenticate_access_key` compare les octets avec `hmac.compare_digest`. Comme la route retourne normalement une réponse `401` au lieu de lever, le générateur `get_db` suit son chemin normal et appelle `commit`, même si aucune écriture n'a eu lieu.

## 5. Exercice 3 — validation Pydantic isolée

### Prédiction

Que devient `"submitted"` ? Que devient `startFriction` ? Que devient le champ inconnu ? Une énergie `101` lève-t-elle `HTTPException` ?

### Code d'expérience

Créez un fichier de travail hors du code applicatif, ou lancez ce bloc dans un interpréteur depuis `interface_API` :

```python
from pydantic import ValidationError

from app.contracts.daily_log import DailyLogUpsertRequest

valid = DailyLogUpsertRequest.model_validate(
    {
        "date": "2026-08-01",
        "status": "submitted",
        "startFriction": 42,
        "presentationOnly": "ignored",
    }
)

print(valid.date, type(valid.date))
print(valid.status, valid.status.value)
print(valid.start_friction)
print(valid.model_dump())

try:
    DailyLogUpsertRequest.model_validate({"energy": 101})
except ValidationError as error:
    print(error.errors())
```

### Explication ligne par ligne

- `ValidationError` est l'exception Pydantic, pas celle que FastAPI expose directement ;
- `model_validate` construit le contrat sans serveur HTTP ;
- la date chaîne devient `datetime.date` ;
- `_missing_` de `CaseInsensitiveEnum` transforme la recherche en comparaison insensible à la casse, puis la valeur stockée est `SUBMITTED` ;
- `alias_generator=to_camel` relie `startFriction` à `start_friction` ;
- `extra="ignore"` retire `presentationOnly` ;
- `Field(le=100)` refuse 101 ;
- Pydantic lève `ValidationError`; dans une requête, FastAPI l'enveloppe en `RequestValidationError` et le handler produit `422`.

### Correction attendue

La sortie montre un vrai objet `date`, l'enum `DailyLogStatus.SUBMITTED`, la valeur 42 et aucun champ `presentationOnly`. L'erreur contient une localisation autour de `energy` et un type de borne supérieure.

## 6. Exercice 4 — observer le `422` HTTP réel

Nous allons utiliser `TestClient` et remplacer l'authentification, car la route réglages est protégée.

### Code complet minimal

```python
from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.main import app
from app.security import get_current_user

fake_user = SimpleNamespace(
    id="clabuser00000000000000001",
    calorieTarget=2200,
    defaultSleepDelayMin=20,
)

app.dependency_overrides[get_current_user] = lambda: fake_user

try:
    with TestClient(app) as client:
        response = client.patch(
            "/api/settings",
            json={"calorieTarget": 25001},
        )
        print(response.status_code)
        print(response.json())
finally:
    app.dependency_overrides.clear()
```

### Prédiction

La route `update_settings` sera-t-elle appelée ? `fake_user.calorieTarget` changera-t-il ? Une vraie session DB sera-t-elle créée par le paramètre `db` de la route ?

### Correction

Le statut vaut `422`. Le corps suit la forme :

```json
{
  "error": "Request validation failed",
  "details": [{
    "location": "body.calorieTarget",
    "message": "Input should be less than or equal to 20000",
    "type": "less_than_equal"
  }]
}
```

Le texte exact est celui de Pydantic 2.13.4 déclaré dans `requirements.txt`.

La fonction de route n'est pas appelée, donc l'attribut reste 2200. Attention : le paramètre `db: Depends(get_db)` appartient à la route. Dans ce bloc, nous n'avons pas remplacé `get_db`. Selon l'ordre de résolution interne, FastAPI peut entrer dans cette dépendance avant de constater toutes les erreurs. Pour rendre le test totalement indépendant de la configuration DB, l'exercice suivant remplace aussi `get_db`.

Le `finally` est essentiel : les overrides sont globaux sur l'objet `app` pendant le processus de test.

## 7. Double de session réutilisable

Voici un double minimal pour les routes qui font `add`, `flush`, `delete` ou `execute` sans réellement dialoguer avec PostgreSQL.

```python
from datetime import datetime


class FakeScalarResult:
    def __init__(self, value=None, rows=None):
        self.value = value
        self.rows = rows or []

    def scalar_one_or_none(self):
        return self.value

    def all(self):
        return self.rows

    def scalars(self):
        return self

    def __iter__(self):
        return iter(self.rows)


class FakeSession:
    def __init__(self):
        self.objects = []
        self.deleted = []
        self.next_result = FakeScalarResult()
        self.flush_count = 0

    def add(self, value):
        self.objects.append(value)

    def flush(self):
        self.flush_count += 1
        for index, value in enumerate(self.objects, start=1):
            if getattr(value, "id", None) is None:
                value.id = f"clabobject{index:014d}"
            if getattr(value, "createdAt", None) is None:
                value.createdAt = datetime(2026, 8, 1, 10, 0)
            if getattr(value, "updatedAt", None) is None:
                value.updatedAt = datetime(2026, 8, 1, 10, 0)

    def execute(self, statement):
        return self.next_result

    def delete(self, value):
        self.deleted.append(value)

    def get(self, model, object_id):
        return None
```

### Pourquoi chaque méthode existe

- `FakeScalarResult` imite seulement les méthodes appelées par les routes testées ;
- `next_result` permet au test de choisir ce qu'une sélection « trouve » ;
- `add` garde l'objet en mémoire ;
- `flush` simule les defaults attribués normalement par SQLAlchemy lors d'un vrai flush ;
- `execute` ignore l'expression SQL construite mais prouve que la route a demandé une exécution ;
- `delete` mémorise la cible au lieu de la supprimer ;
- `get` retourne `None`, suffisant quand aucune liaison objectif n'est demandée.

Ce faux n'est pas un moteur SQL. Il teste l'orchestration du routeur, pas la correction de SQLAlchemy/PostgreSQL. Les tests d'intégration DB seraient un niveau séparé avec une base jetable.

## 8. Fixture d'overrides sans fuite

```python
from contextlib import contextmanager
from types import SimpleNamespace

from app.database import get_db
from app.main import app
from app.security import get_current_user


@contextmanager
def isolated_api(fake_db):
    fake_user = SimpleNamespace(
        id="clabuser00000000000000001",
        calorieTarget=2200,
        defaultSleepDelayMin=20,
    )

    def override_db():
        yield fake_db

    app.dependency_overrides[get_current_user] = lambda: fake_user
    app.dependency_overrides[get_db] = override_db
    try:
        yield fake_user
    finally:
        app.dependency_overrides.clear()
```

Le décorateur `@contextmanager` transforme le générateur en gestionnaire `with`. Le code avant `yield` installe les doubles ; la valeur `fake_user` est rendue au test ; le `finally` nettoie même si une assertion échoue.

Pourquoi override-t-on les deux fonctions ? Remplacer `get_current_user` court-circuite sa dépendance interne, mais une route comme `PATCH /api/settings` demande aussi directement `get_db`.

## 9. Exercice 5 — lecture et modification de réglages isolées

### Test

```python
from fastapi.testclient import TestClient

from app.main import app


fake_db = FakeSession()

with isolated_api(fake_db) as fake_user:
    with TestClient(app) as client:
        before = client.get("/api/settings")
        changed = client.patch(
            "/api/settings",
            json={
                "calorieTarget": 2400,
                "defaultSleepDelayMin": 30,
            },
        )
        after = client.get("/api/settings")

    assert before.status_code == 200
    assert before.json()["settings"]["calorieTarget"] == 2200
    assert changed.status_code == 200
    assert changed.json() == {
        "settings": {
            "calorieTarget": 2400,
            "defaultSleepDelayMin": 30,
            "theme": "dark",
        }
    }
    assert after.json()["settings"]["calorieTarget"] == 2400
    assert fake_user.calorieTarget == 2400
    assert fake_db.flush_count == 1
```

### Prédiction

Pourquoi `GET` voit-il le changement sans base ? Pourquoi le compteur de flush vaut-il un et non trois ?

### Correction

Les trois requêtes reçoivent le même objet `fake_user` capturé par la lambda d'override. `PATCH` modifie directement ses attributs. Les deux `GET` appellent seulement `_settings_payload` et ne demandent pas de session explicite, donc ils ne flushent pas. `PATCH` appelle une fois `db.add` puis `db.flush`.

Ce test prouve la logique du routeur, pas la persistance après redémarrage. C'est précisément ce qui le rend non destructif.

## 10. Exercice 6 — création multiple de tâches

### Test

```python
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app


fake_db = FakeSession()

with isolated_api(fake_db):
    with patch("app.routers.tasks.recompute_around_date") as recompute:
        with TestClient(app) as client:
            response = client.post(
                "/api/tasks",
                json={
                    "titles": ["  Lire tasks.py  ", "Tester la route"],
                    "date": "2026-08-01",
                    "importance": "high",
                    "estimatedMinutes": 45,
                },
            )

assert response.status_code == 200
payload = response.json()
assert [task["title"] for task in payload["tasks"]] == [
    "Lire tasks.py",
    "Tester la route",
]
assert payload["task"] == payload["tasks"][0]
assert len(fake_db.objects) == 2
assert fake_db.flush_count == 1
recompute.assert_called_once_with(
    fake_db,
    "clabuser00000000000000001",
    "2026-08-01",
)
```

### Prédiction

Avant le test, prédisez : espaces conservés ou retirés ? deux flush ou un ? `task` contient-il le premier ou le dernier objet ?

### Correction détaillée

La compréhension `[title.strip() for title in body.titles]` retire les espaces. La boucle crée deux `Task` et les ajoute. `db.flush()` est placé après la boucle, donc un seul appel. `serialized[0]` alimente `task`; `tasks` reçoit toute la liste.

Le patch remplace le recalcul, qui exige normalement plusieurs lectures de journaux/tâches/calendrier. Nous vérifions qu'il est déclenché avec la bonne date sans simuler tout ce sous-système.

`objectiveId` est absent : `_validate_objective_access` retourne immédiatement, donc notre faux `execute` n'est pas sollicité pour un objectif.

## 11. Exercice 7 — cas limite : liste de titres vides

### Test

```python
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app


fake_db = FakeSession()

with isolated_api(fake_db):
    with patch("app.routers.tasks.recompute_around_date"):
        with TestClient(app) as client:
            response = client.post(
                "/api/tasks",
                json={"titles": ["  ", ""]},
            )

assert response.status_code == 200
assert response.json() == {"task": None, "tasks": []}
assert fake_db.objects == []
```

### Prédiction et correction

Le contrat autorise une liste de chaînes vides : aucun `min_length` ne s'applique aux éléments. La route strippe, filtre les chaînes fausses, puis boucle sur une liste vide. Elle appelle malgré tout `flush` et `recompute_around_date`, puis répond succès avec aucune tâche.

Ce test révèle un comportement réel, sans prétendre qu'il est idéal. Une amélioration proposée devrait être clairement séparée du constat, par exemple un validateur exigeant au moins un titre non vide.

## 12. Exercice 8 — modification d'une tâche existante

### Préparer l'objet trouvé

```python
from datetime import date, datetime
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.models import Task


existing = Task(
    id="clabtask00000000000000001",
    userId="clabuser00000000000000001",
    title="Lire Python",
    date=date(2026, 8, 1),
    importance="MEDIUM",
    productive=True,
    estimatedMinutes=30,
    completionPercent=0,
    status="PLANNED",
    objectiveId=None,
    createdAt=datetime(2026, 8, 1, 9, 0),
    updatedAt=datetime(2026, 8, 1, 9, 0),
)

fake_db = FakeSession()
fake_db.next_result = FakeScalarResult(value=existing)

with isolated_api(fake_db):
    with patch("app.routers.tasks.recompute_around_date") as recompute:
        with TestClient(app) as client:
            response = client.patch(
                "/api/tasks",
                json={
                    "id": "clabtask00000000000000001",
                    "completionPercent": 100,
                    "status": "done",
                },
            )

assert response.status_code == 200
assert response.json()["task"]["status"] == "done"
assert response.json()["task"]["completionPercent"] == 100
assert existing.status == "DONE"
assert existing.completionPercent == 100
recompute.assert_called_once_with(
    fake_db,
    "clabuser00000000000000001",
    "2026-08-01",
)
```

### Correction

`fake_db.execute(...).scalar_one_or_none()` retourne `existing`. Les enums Pydantic donnent `TaskStatus.DONE`; la route stocke `.value`, donc `DONE` dans le modèle. Le sérialiseur applique `.lower()`, donc `done` en JSON.

Les champs non envoyés restent intacts. C'est le sens de `PATCH`. Le test vérifie à la fois l'objet Python muté, la sortie sérialisée et le callback de recalcul.

## 13. Exercice 9 — `404` sans mutation

### Test

```python
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app


fake_db = FakeSession()
fake_db.next_result = FakeScalarResult(value=None)

with isolated_api(fake_db):
    with patch("app.routers.tasks.recompute_around_date") as recompute:
        with TestClient(app) as client:
            response = client.patch(
                "/api/tasks",
                json={
                    "id": "clabmissing000000000000001",
                    "status": "done",
                },
            )

assert response.status_code == 404
assert response.json() == {"error": "Task not found"}
assert fake_db.flush_count == 0
recompute.assert_not_called()
```

### Ordre à reconstruire

1. Le corps valide construit `TaskUpdateRequest`.
2. Les overrides fournissent utilisateur et session.
3. La sélection rend `None`.
4. `raise HTTPException` interrompt la fonction.
5. Les lignes d'affectation, flush et recalcul ne sont jamais atteintes.
6. Le handler `HTTPException` de `main.py` transforme `detail` en clé `error`.

## 14. Exercice 10 — suppression d'événement sans supprimer

Le faux enregistre la cible dans `deleted`; aucune base n'est touchée.

```python
from datetime import datetime
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.models import CalendarEvent


event = CalendarEvent(
    id="clabevent0000000000000001",
    userId="clabuser00000000000000001",
    title="Examen",
    type="EXAM",
    impact="HIGH",
    start=datetime(2026, 8, 2, 9, 0),
    end=datetime(2026, 8, 2, 11, 0),
    expectedStress=80,
    expectedPreparationLoad=90,
)

fake_db = FakeSession()
fake_db.next_result = FakeScalarResult(value=event)

with isolated_api(fake_db):
    with patch("app.routers.calendar_events.recompute_around_date") as recompute:
        with TestClient(app) as client:
            response = client.delete(
                "/api/calendar-events",
                params={"id": event.id},
            )

assert response.status_code == 200
assert response.json() == {"ok": True}
assert fake_db.deleted == [event]
assert fake_db.flush_count == 1
recompute.assert_called_once_with(
    fake_db,
    "clabuser00000000000000001",
    "2026-08-02",
)
```

### Prédiction et correction

La route capture `existing.start.date().isoformat()` avant `delete`. Le faux ne détruit rien, mais prouve l'intention d'appeler `db.delete`. L'effet réel serait une suppression physique seulement après le commit de `get_db`.

L'événement doit appartenir à l'utilisateur dans la requête SQL réelle. Notre faux ne comprend pas la clause SQL; un test d'intégration serait nécessaire pour vérifier l'isolation SQL elle-même.

## 15. Exercice 11 — commit, rollback et close

Ici nous testons directement le générateur réel `get_db`, en remplaçant seulement sa fabrique de session.

### Faux transactionnel

```python
class TransactionSpy:
    def __init__(self):
        self.commits = 0
        self.rollbacks = 0
        self.closes = 0

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1

    def close(self):
        self.closes += 1
```

### Chemin de succès

```python
from unittest.mock import patch

from app.database import get_db


spy = TransactionSpy()

with patch("app.database.SessionLocal", return_value=spy):
    dependency = get_db()
    yielded = next(dependency)
    assert yielded is spy
    try:
        next(dependency)
    except StopIteration:
        pass

assert spy.commits == 1
assert spy.rollbacks == 0
assert spy.closes == 1
```

### Chemin d'exception

```python
from unittest.mock import patch

from app.database import get_db


spy = TransactionSpy()

with patch("app.database.SessionLocal", return_value=spy):
    dependency = get_db()
    next(dependency)
    try:
        dependency.throw(RuntimeError("simulated route failure"))
    except RuntimeError as error:
        assert str(error) == "simulated route failure"

assert spy.commits == 0
assert spy.rollbacks == 1
assert spy.closes == 1
```

### Explication

`next` avance jusqu'à `yield db`. Un deuxième `next` simule une fin normale : le code après `yield` commit, puis le générateur se termine par `StopIteration` et ferme.

`generator.throw` simule une exception remontant de ce qui utilisait la ressource. Le bloc `except` rollback, `raise` relance, `finally` ferme. Ce test démontre le protocole sans serveur et sans SQL.

## 16. Exercice 12 — décoder et altérer une session

### Code

```python
from app.security import decode_session, encode_session


token, expiration = encode_session("clabuser00000000000000001")
print(token)
print(expiration)

assert decode_session(token) == "clabuser00000000000000001"

body, signature = token.split(".", 1)
tampered = ("a" if body[0] != "a" else "b") + body[1:] + "." + signature
assert decode_session(tampered) is None
assert decode_session("missing-dot") is None
assert decode_session(None) is None
```

### Prédiction

Altérer un seul caractère du corps tout en gardant la signature peut-il changer silencieusement l'utilisateur ? Une chaîne mal formée lève-t-elle une erreur vers l'appelant ?

### Correction

`_sign(body)` recalcule le HMAC et `compare_digest` échoue, donc `None`. `decode_session` considère les jetons invalides comme absence de session : il retourne `None` pour les formats et décodages invalides. `get_current_user` transforme ensuite ce `None` en `401`.

Base64url n'est pas du chiffrement. On pourrait décoder le corps d'un jeton valide, mais sans le secret on ne peut pas fabriquer une signature acceptée pour un corps modifié.

## 17. Faux service Whisper de succès

Nous testons la passerelle `/api/transcribe`, pas le modèle lourd.

### Double asynchrone

```python
class FakeUpstreamResponse:
    status_code = 200
    text = '{"text":"Bonjour","language":"fr"}'

    def json(self):
        return {"text": "Bonjour", "language": "fr"}


class FakeAsyncClient:
    def __init__(self, timeout):
        self.timeout = timeout
        self.received_url = None
        self.received_files = None

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, traceback):
        return False

    async def post(self, url, files):
        self.received_url = url
        self.received_files = files
        return FakeUpstreamResponse()
```

`__aenter__` et `__aexit__` permettent l'utilisation par `async with`. `post` est `async def`, donc `await client.post(...)` fonctionne. Retourner `False` depuis `__aexit__` signifie qu'une exception éventuelle ne doit pas être supprimée.

### Test

```python
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app


fake_db = FakeSession()

with isolated_api(fake_db):
    with patch(
        "app.routers.transcribe.httpx.AsyncClient",
        FakeAsyncClient,
    ):
        with TestClient(app) as client:
            response = client.post(
                "/api/transcribe",
                files={
                    "file": (
                        "voice.webm",
                        b"not-real-audio-but-not-decoded-by-the-fake",
                        "video/webm",
                    )
                },
            )

assert response.status_code == 200
assert response.json() == {"text": "Bonjour"}
```

### Prédiction et correction

Le type `video/webm` est autorisé. La route lit et ferme l'upload, puis notre classe remplace `httpx.AsyncClient`. Le faux ne décode pas l'audio, donc les octets peuvent être arbitraires.

Le faux amont renvoie `language`, mais la passerelle construit explicitement `{"text": str(data.get("text") or "")}`. La réponse principale ne contient donc que `text`.

Ce test est rapide, déterministe et ne dépend ni du port 8001, ni de ffmpeg, ni du modèle.

## 18. Exercice 13 — type audio refusé avant le réseau

### Test

```python
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app


fake_db = FakeSession()

with isolated_api(fake_db):
    with patch("app.routers.transcribe.httpx.AsyncClient") as client_class:
        with TestClient(app) as client:
            response = client.post(
                "/api/transcribe",
                files={"file": ("notes.txt", b"hello", "text/plain")},
            )

assert response.status_code == 415
assert response.json() == {"error": "Unsupported audio type"}
client_class.assert_not_called()
```

### Correction

`_is_supported_audio_type("text/plain")` retourne faux : la chaîne ne commence pas par `audio/` et n'est ni `application/octet-stream` ni `video/webm`. `HTTPException` est levée avant `file.read` et avant la création du client HTTP.

L'assertion `assert_not_called` prouve l'ordre, pas seulement le statut.

## 19. Exercice 14 — limite de taille sans 25 Mio

La limite réelle par défaut est grande. Pour tester la branche avec cinq octets, remplaçons la fonction `get_settings` telle qu'elle est importée dans le module routeur.

```python
from types import SimpleNamespace
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app


small_settings = SimpleNamespace(
    max_audio_bytes=4,
    whisper_timeout_seconds=10,
    whisper_service_url="http://127.0.0.1:8001/transcribe",
)

fake_db = FakeSession()

with isolated_api(fake_db):
    with patch(
        "app.routers.transcribe.get_settings",
        return_value=small_settings,
    ):
        with patch("app.routers.transcribe.httpx.AsyncClient") as client_class:
            with TestClient(app) as client:
                response = client.post(
                    "/api/transcribe",
                    files={"file": ("voice.webm", b"12345", "video/webm")},
                )

assert response.status_code == 413
assert response.json() == {"error": "Audio file is too large"}
client_class.assert_not_called()
```

### Lecture exacte

La route demande `read(max_audio_bytes + 1)`, donc cinq octets. `len(content) > 4` est vrai. Elle ferme le fichier puis lève `413`. L'appel réseau n'est jamais construit.

On patche `app.routers.transcribe.get_settings`, pas seulement `app.config.get_settings`, car le routeur a déjà lié le nom local avec `from ..config import get_settings`.

## 20. Exercice 15 — réponse amont transformée en `502`

### Faux en erreur

```python
class BusyUpstreamResponse:
    status_code = 429
    text = '{"detail":"Transcription service is busy"}'

    def json(self):
        return {"detail": "Transcription service is busy"}


class BusyAsyncClient(FakeAsyncClient):
    async def post(self, url, files):
        return BusyUpstreamResponse()
```

### Test

```python
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app


fake_db = FakeSession()

with isolated_api(fake_db):
    with patch(
        "app.routers.transcribe.httpx.AsyncClient",
        BusyAsyncClient,
    ):
        with TestClient(app) as client:
            response = client.post(
                "/api/transcribe",
                files={"file": ("voice.webm", b"audio", "video/webm")},
            )

assert response.status_code == 502
assert response.json() == {"error": "Transcription service is busy"}
```

### Prédiction et correction

Le service amont dit `429`, mais la passerelle teste seulement `upstream.status_code >= 400` puis lève **sa propre** `HTTPException(status_code=502, ...)`. Le message est conservé depuis `detail`; le statut ne l'est pas.

Cette expérience distingue deux niveaux : erreur native Whisper `{detail:...}` et erreur exposée par l'API principale `{error:...}`.

## 21. Exercice 16 — JSON amont invalide

```python
class InvalidJsonResponse:
    status_code = 200
    text = "not-json"

    def json(self):
        raise ValueError("invalid JSON")


class InvalidJsonAsyncClient(FakeAsyncClient):
    async def post(self, url, files):
        return InvalidJsonResponse()
```

Testez ce client comme dans l'exercice précédent et prédisez. Correction : le statut amont n'active pas la branche `>=400`; le second `try` appelle `json()`, capture `ValueError` et lève `502 Whisper returned invalid JSON`. Le `from error` conserve la cause dans la traceback serveur.

Assertions :

```python
assert response.status_code == 502
assert response.json() == {"error": "Whisper returned invalid JSON"}
```

## 22. Exercice 17 — test direct du sémaphore Whisper

Tester l'inférence réelle serait lent. On vérifie la branche « occupé » avec un faux sémaphore dont `locked()` retourne vrai. La route lève avant `async with`, donc ce faux n'a pas besoin d'implémenter le protocole de contexte asynchrone.

Depuis le dossier `interface_API` choisi au début du laboratoire, le package `services` est dans le dossier parent. Les trois premières lignes l'ajoutent explicitement au chemin d'import du processus de test.

```python
import sys
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient


repository_root = Path.cwd().parent
sys.path.insert(0, str(repository_root))

import services.whisper_service as whisper_service


class LockedSemaphore:
    def locked(self):
        return True


with patch.object(
    whisper_service,
    "transcription_slots",
    LockedSemaphore(),
):
    with TestClient(whisper_service.app) as client:
        response = client.post(
            "/transcribe",
            files={"file": ("voice.webm", b"audio", "video/webm")},
        )

assert response.status_code == 429
assert response.json() == {"detail": "Transcription service is busy"}
```

Le patch est limité au bloc `with` et restaure le vrai sémaphore ensuite. Il évite de partager un objet `asyncio.Semaphore` entre la boucle d'`asyncio.run` et celle de `TestClient`, ce qui rend le test déterministe.

L'ordre réel reste visible : le fichier est lu et le temporaire créé avant le test `locked`; le `finally` doit supprimer ce temporaire malgré le `429`.

## 23. Suite `unittest` conseillée

Vous pouvez regrouper les expériences déterministes dans `interface_API/tests/test_course_http_lab.py`. Ce fichier serait du code de test, pas une modification de l'application.

Structure recommandée :

```python
import unittest

from fastapi.testclient import TestClient

from app.main import app


class CourseHttpLabTests(unittest.TestCase):
    def setUp(self):
        self.db = FakeSession()
        self.override_context = isolated_api(self.db)
        self.user = self.override_context.__enter__()
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        self.override_context.__exit__(None, None, None)

    def test_settings_validation(self):
        response = self.client.patch(
            "/api/settings",
            json={"calorieTarget": 25001},
        )
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["error"], "Request validation failed")


if __name__ == "__main__":
    unittest.main()
```

### Explication

- `setUp` s'exécute avant chaque test et crée un état neuf ;
- `tearDown` s'exécute après chaque test et ferme/nettoie ;
- `self` désigne l'instance courante du cas de test ;
- `assertEqual` produit un diagnostic plus lisible qu'un simple `assert` dans `unittest` ;
- le garde `if __name__ == "__main__"` permet aussi l'exécution directe.

Commande ciblée :

```powershell
python -m unittest tests.test_course_http_lab -v
```

N'ajoutez au fichier que les imports/helpers utilisés. Le laboratoire les présente séparément pour apprendre ; un vrai fichier doit contenir `FakeSession`, `isolated_api` et les classes fake audio avant les tests qui les référencent.

## 24. Table de diagnostic

| Observation | Question à poser | Fichier à relire |
|---|---|---|
| `404 Not Found` | le chemin/méthode est-il exact et le routeur inclus ? | `app/main.py`, `app/routers/*` |
| `401 Unauthorized` | l'override cible-t-il exactement l'objet callable importé par la route ? | `app/security.py` |
| `422` inattendu | localisation et contrat correspondent-ils au JSON ? | `app/contracts/*` |
| une vraie DB est contactée | `get_db` a-t-il aussi été override ? | `app/database.py` |
| le patch n'agit pas | patche-t-on le nom dans le module utilisateur ? | import du routeur concerné |
| `500` dans un test fake | le faux implémente-t-il la méthode appelée ensuite ? | traceback + route |
| audio appelle le réseau | `AsyncClient` est-il patché dans `app.routers.transcribe.httpx` ? | `routers/transcribe.py` |
| réponse audio contient seulement `text` | c'est la transformation volontaire de la passerelle | `routers/transcribe.py` |
| objet créé sans id/timestamps | le faux `flush` simule-t-il les defaults SQLAlchemy ? | `models.py`, faux de test |
| override affecte un autre test | `dependency_overrides.clear()` est-il dans un `finally` ? | fixture du laboratoire |

## 25. Projet final guidé

Écrivez un test non destructif qui prouve les cinq faits suivants :

1. `PATCH /api/settings` accepte la chaîne numérique `"2400"` et renvoie le nombre 2400 ;
2. un champ `theme="light"` dans le JSON est ignoré et la réponse reste `dark` ;
3. `calorieTarget=-1` produit `422` sans flush ;
4. l'absence d'override utilisateur produit `401` sur une route protégée ;
5. le nettoyage final laisse `app.dependency_overrides == {}`.

### Plan de correction

Pour les trois premiers, entrez dans `isolated_api(FakeSession())`. Envoyez les requêtes dans cet ordre et mémorisez le compteur de flush avant l'entrée invalide. `SettingsUpdateRequest` convertit la chaîne en entier. `extra="ignore"` retire `theme`; `_settings_payload` code `dark`. La borne `ge=0` interrompt avant la route, donc le compteur ne change pas.

Pour le quatrième, sortez du contexte afin que le `finally` nettoie. Un `TestClient(app).get("/api/settings")` sans cookie appelle le vrai `get_current_user` et doit répondre `401`; il peut ouvrir une session réelle pour chercher l'utilisateur seulement si un cookie décodable est présent. Sans cookie, `decode_session(None)` retourne immédiatement `None`, puis la dépendance lève.

Pour le cinquième, placez l'assertion après le bloc :

```python
assert app.dependency_overrides == {}
```

Une correction robuste sépare le test authentifié isolé et le test 401 en deux méthodes pour éviter qu'une panne avant nettoyage masque l'origine.

## 26. Debrief et rappel actif

Vous devez maintenant pouvoir reconstruire ces chaînes :

```text
JSON invalide
→ Pydantic
→ RequestValidationError
→ handler 422
→ route non appelée
```

```text
Cookie absent
→ Depends(get_current_user)
→ decode_session(None)
→ HTTPException 401
→ handler {error}
```

```text
Route avec DB, succès
→ get_db jusqu'à yield
→ route + flush
→ reprise du générateur
→ commit
→ close
```

```text
Upload audio
→ type et taille
→ AsyncClient mocké
→ réponse amont
→ validation JSON
→ {text} seulement
```

### Questions de rappel

1. Pourquoi un override de `get_current_user` ne suffit-il pas toujours à éviter la vraie DB ?
2. Pourquoi patcher `app.config.get_settings` peut-il ne pas modifier la route transcription ?
3. Quelle différence entre tester un routeur avec `FakeSession` et tester les requêtes SQL ?
4. Quelle assertion prouve que le réseau audio n'a pas été touché ?
5. Pourquoi `finally` est-il indispensable dans les fixtures ?

### Réponses

1. La route peut demander directement `get_db` en plus de la sous-dépendance d'authentification.
2. Le routeur a importé et lié son propre nom `get_settings`; il faut patcher le nom là où il est utilisé.
3. Le faux vérifie branches/appels/mutations, pas l'exécution SQL ni les contraintes PostgreSQL.
4. `client_class.assert_not_called()` dans les branches 413/415, ou le remplacement complet par `FakeAsyncClient` dans le succès.
5. Les overrides/patches sont globaux pendant le processus ; une exception ne doit pas contaminer le test suivant.
