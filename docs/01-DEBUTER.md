# Débuter : installer et lancer le projet

## Ce que vous allez démarrer

L’application complète a besoin de quatre processus :

| Service | Rôle | Adresse locale |
| --- | --- | --- |
| PostgreSQL | Conserve les données | `localhost:5432` |
| FastAPI | Exécute la logique métier | `http://127.0.0.1:8000` |
| Whisper | Transcrit les enregistrements audio | `http://127.0.0.1:8001` |
| Next.js | Affiche l’interface web | `http://127.0.0.1:3000` |

Le script `scripts/dev.ps1` démarre les trois applications, mais il ne démarre pas PostgreSQL et n’installe aucune dépendance. Il confirme le démarrage de FastAPI ; pour Whisper, il sonde d’abord le service puis tente de le lancer sans refaire automatiquement un contrôle de santé.

## Prérequis

Il faut disposer de :

- Docker Desktop ou un PostgreSQL compatible ;
- Node.js et `pnpm`, ou les scripts utilisant le runtime fourni par Codex dans cet espace de travail ;
- Python et la possibilité de créer un environnement virtuel ;
- Git uniquement si vous souhaitez versionner vos changements.

Les versions minimales de Node.js et Python ne sont pas déclarées dans le dépôt. C’est une information manquante, pas une invitation à choisir une version au hasard.

## 1. Installer les dépendances JavaScript

Depuis la racine du projet :

```powershell
pnpm install
```

Cette commande lit `package.json` et `pnpm-lock.yaml`, puis installe Next.js, React, Prisma et les bibliothèques de l’interface.

## 2. Préparer la configuration

Copiez le fichier d’exemple :

```powershell
Copy-Item .env.example .env
```

Ouvrez ensuite `.env` et remplacez au minimum :

- `APP_ACCESS_KEY` par une longue clé privée utilisée pour l’écran de connexion ;
- `AUTH_SECRET` par un autre secret long et aléatoire utilisé pour signer le cookie ;
- `DATABASE_URL` si PostgreSQL n’utilise pas les valeurs locales fournies.

Ne commitez jamais `.env`. Le fichier `.env.example` contient seulement des exemples non secrets et peut être versionné.

## 3. Démarrer PostgreSQL

```powershell
docker compose up -d
```

`docker-compose.yml` lance PostgreSQL 16, expose le port `5432` et conserve les données dans le volume Docker `life-regime-postgres`.

Vérifiez son état avec :

```powershell
docker compose ps
```

## 4. Créer ou mettre à jour le schéma

Pour une première base locale :

```powershell
pnpm prisma:generate
pnpm prisma:migrate --name init
```

La première ligne génère le client Prisma à partir de `prisma/schema.prisma`. La seconde applique les migrations existantes et crée une migration si le schéma local a changé. N’utilisez pas `--name init` pour une future évolution : choisissez alors un nom précis comme `add_task_due_time`.

Si `pnpm` n’est pas installé globalement dans cet espace Codex, utilisez les wrappers Windows :

```powershell
.\scripts\prisma-generate.cmd
.\scripts\prisma-migrate.cmd init
```

## 5. Installer l’API Python

```powershell
Set-Location interface_API
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Set-Location ..
```

Les lignes font respectivement ceci : entrer dans le dossier de l’API, créer un environnement Python isolé, l’activer, installer FastAPI/SQLAlchemy, puis revenir à la racine.

## 6. Installer Whisper

```powershell
python -m pip install -r services\requirements.txt
```

Cette étape installe un second petit serveur FastAPI, OpenAI Whisper et le support FFmpeg local. Le premier chargement du modèle peut être plus lent. Consultez [`whisper.md`](whisper.md) pour les limites audio et la configuration.

## 7. Lancer l’ensemble

```powershell
.\scripts\dev.ps1
```

Si PowerShell bloque les scripts :

```powershell
.\scripts\dev.cmd
```

Le script vérifie FastAPI, sonde puis tente de démarrer Whisper si nécessaire, et garde Next.js au premier plan. Il faut encore vérifier manuellement `/health` sur le port `8001`. Ouvrez ensuite `http://127.0.0.1:3000`.

## 8. Se connecter

La page `/login` demande la valeur de `APP_ACCESS_KEY`. Après validation, Next.js crée un cookie `life_regime_session` :

- `httpOnly` empêche JavaScript dans la page de le lire ;
- `sameSite=lax` limite certains envois entre sites ;
- la signature HMAC détecte toute modification ;
- l’expiration actuelle est de 30 jours.

Sans `APP_ACCESS_KEY`, le développement utilise `dev-access-key`. En production (`NODE_ENV=production` pour Next.js et `ENV=production` pour FastAPI), les vrais secrets sont obligatoires.

## 9. Vérifier l’installation

Vérifiez d’abord l’API :

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/health
```

Une réponse normale contient `ok: true`. Vérifiez ensuite le service audio :

```powershell
Invoke-RestMethod http://127.0.0.1:8001/health
```

Enfin, contrôlez tout le code :

```powershell
pnpm check
```

Cette dernière commande peut prendre du temps : elle enchaîne le typage TypeScript, les tests Python et un build Next.js de production.

## Arrêter les services

`Ctrl+C` dans le terminal arrête le processus Next.js au premier plan. FastAPI et Whisper peuvent avoir été démarrés en arrière-plan par le script. Aucun script d’arrêt dédié n’existe dans le dépôt ; vérifiez donc les processus qui utilisent les ports `8000` et `8001` avant de les arrêter manuellement.

N’utilisez pas `docker compose down -v` sauf si vous voulez supprimer le volume PostgreSQL et ses données. `docker compose stop` est non destructif.

## Premier diagnostic

| Symptôme | Vérification |
| --- | --- |
| Next.js affiche une erreur `503` | FastAPI répond-il sur le port `8000` ? `INTERNAL_API_URL` est-il correct ? |
| L’API ne démarre pas | PostgreSQL répond-il ? `DATABASE_URL` est-il correct ? Les dépendances Python sont-elles installées ? |
| La connexion échoue | La valeur saisie correspond-elle exactement à `APP_ACCESS_KEY` ? |
| Une session Next est refusée par FastAPI | `AUTH_SECRET` et `APP_ACCESS_KEY` sont-ils identiques pour les deux processus ? |
| La transcription échoue | Whisper répond-il sur `8001` ? Le type et la taille du fichier sont-ils acceptés ? |
| Les styles d’une feature disparaissent en production | `tailwind.config.ts` doit continuer à scanner `features/**/*`. |

Le guide détaillé se trouve dans [`09-TESTS-ET-DEPANNAGE.md`](09-TESTS-ET-DEPANNAGE.md).
