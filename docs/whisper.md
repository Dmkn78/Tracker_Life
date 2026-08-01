# Transcription locale avec Whisper

La transcription vocale est implémentée. Elle permet au formulaire Daily Log d’enregistrer un audio dans le navigateur, de le transcrire localement et de sauvegarder le texte dans `DailyLog.voiceTranscript`.

## Flux complet

```text
MediaRecorder dans DailyLogForm
→ lib/whisper.ts
→ POST Next.js /api/transcribe
→ proxyApiRequest
→ POST FastAPI /api/transcribe
→ POST service Whisper /transcribe
→ modèle local OpenAI Whisper
→ JSON {"text": "..."}
→ autosave du Daily Log
```

Le navigateur ne contacte jamais directement le port `8001`. FastAPI constitue la frontière authentifiée et bornée. Le proxy Next conserve la même origine et transmet le cookie.

## Installation

Depuis la racine :

```powershell
python -m pip install -r services\requirements.txt
```

Les dépendances comprennent le serveur FastAPI secondaire, OpenAI Whisper, `imageio-ffmpeg` et `python-dotenv`.

## Lancement

Whisper démarre avec le script global :

```powershell
.\scripts\dev.ps1
```

Ou seul :

```powershell
.\scripts\start-whisper-service.cmd
```

Vérification :

```powershell
Invoke-RestMethod http://127.0.0.1:8001/health
```

La réponse attendue contient `ok: true`.

## Configuration

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `WHISPER_MODEL` | `tiny` | nom du modèle chargé par `whisper.load_model` |
| `MAX_AUDIO_BYTES` | 25 Mio | limite lue par FastAPI et le service Whisper |
| `WHISPER_SERVICE_URL` | `http://127.0.0.1:8001/transcribe` | adresse utilisée par FastAPI |
| `WHISPER_TIMEOUT_SECONDS` | `180` | timeout de l’appel FastAPI → Whisper |

Le service charge le `.env` racine. Un modèle plus grand peut améliorer la transcription mais demande davantage de mémoire et de temps. Aucun benchmark propre à cette machine n’est présent dans le dépôt.

Les timeouts sont volontairement emboîtés : 180 secondes pour FastAPI → Whisper, 185 secondes pour le proxy Next → FastAPI et 190 secondes pour le client navigateur. La couche interne doit échouer avant son appelant afin que celui-ci puisse renvoyer une erreur explicite.

Limite actuelle : le timeout HTTP de FastAPI arrête l’attente de la réponse, mais il n’annule pas forcément le thread où `model.transcribe` travaille déjà. Whisper peut donc rester occupé après un timeout public et refuser temporairement la requête suivante avec son code interne `429`.

## Sécurité et limites

FastAPI :

- exige une session valide ;
- accepte `audio/*`, `video/webm` ou `application/octet-stream` ;
- lit au maximum `MAX_AUDIO_BYTES + 1` pour détecter un dépassement ;
- ferme le fichier reçu ;
- applique un timeout à l’appel interne ;
- normalise les erreurs du service.

Le service Whisper :

- répète la validation de type et taille, car une frontière interne doit rester défensive ;
- refuse une seconde transcription simultanée avec `429` ;
- charge le modèle une seule fois grâce au cache ;
- exécute les traitements bloquants dans un threadpool ;
- écrit un fichier temporaire puis le supprime dans un bloc `finally` ;
- utilise `imageio-ffmpeg` et crée au besoin un shim local sous `.runtime/ffmpeg`.

## Codes d’erreur

| Code vu côté API | Signification |
| --- | --- |
| `401` | session absente ou invalide |
| `413` | fichier supérieur à la limite |
| `415` | type MIME non accepté |
| `422` | validation de la requête multipart par FastAPI avant l’appel interne |
| `502` | le service a répondu en erreur ou avec un JSON invalide |
| `503` | service inaccessible ou appel HTTP impossible |

Le service interne peut retourner `422` lorsque l’audio est inexploitable ou `429` lorsqu’il est occupé ; FastAPI traduit actuellement ces erreurs upstream en `502` pour le client public.

## Fichiers concernés

| Fichier | Responsabilité |
| --- | --- |
| `features/daily-log/components/DailyLogForm.tsx` | enregistrement et insertion du texte dans le formulaire |
| `lib/whisper.ts` | upload multipart, timeout navigateur de 190 secondes et parsing de `{text}` |
| `app/api/transcribe/route.ts` | proxy same-origin vers FastAPI |
| `interface_API/app/routers/transcribe.py` | auth, limites, timeout et adaptation d’erreurs |
| `services/whisper_service.py` | modèle, FFmpeg, concurrence et transcription |
| `services/requirements.txt` | dépendances Python du service |

## Dépannage

- `503` : vérifier que le port `8001` répond et que `WHISPER_SERVICE_URL` est correct.
- `413` : vérifier que la même valeur positive `MAX_AUDIO_BYTES` est visible par FastAPI et Whisper.
- `415` : inspecter le MIME produit par le navigateur.
- `502` après une longue attente : consulter les logs Whisper, la mémoire disponible et le modèle choisi.
- erreur FFmpeg : réinstaller `imageio-ffmpeg`, vérifier les droits d’écriture de `.runtime/ffmpeg` et le `PATH` du processus.
- transcription vide : tester un audio audible et vérifier le format ; une réponse vide mais valide reste actuellement `{"text":""}`.

Aucun test automatisé n’exécute actuellement un vrai modèle Whisper. Toute modification de ce flux exige au minimum un test manuel et idéalement un test du proxy avec service simulé.
