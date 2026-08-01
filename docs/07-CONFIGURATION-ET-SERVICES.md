# Configuration, services et commandes

## Le fichier `.env`

Un fichier `.env` associe des noms de configuration à des valeurs. Il évite d’inscrire les secrets directement dans le code.

- `.env.example` documente les noms attendus avec des valeurs factices ;
- `.env` contient les vraies valeurs locales et ne doit pas être commité ;
- FastAPI charge d’abord `interface_API/.env`, puis le `.env` racine comme complément ;
- Next.js lit le `.env` racine ;
- le service Whisper charge aussi le `.env` racine.

Ne copiez jamais le contenu réel de `.env` dans un ticket, une capture d’écran, un log ou cette documentation.

## Variables réellement utilisées

| Variable | Lue par | Rôle | Valeur locale d’exemple |
| --- | --- | --- | --- |
| `DATABASE_URL` | Prisma, FastAPI | Connexion PostgreSQL | `postgresql://postgres:postgres@localhost:5432/life_regime_tracker?schema=public` |
| `APP_ACCESS_KEY` | Next.js, FastAPI | Clé saisie à la connexion | secret à remplacer |
| `AUTH_SECRET` | Next.js, FastAPI | Signature HMAC du cookie | secret différent à remplacer |
| `INTERNAL_API_URL` | Next.js serveur | Adresse interne de FastAPI | `http://127.0.0.1:8000` |
| `ENV` | FastAPI | Active les exigences de production | `development` |
| `FRONTEND_ORIGINS` | FastAPI | Origines CORS autorisées, séparées par virgule | ports Next locaux |
| `API_HOST` | `interface_API/run.py` | Adresse d’écoute FastAPI | `127.0.0.1` |
| `API_PORT` | `interface_API/run.py` | Port FastAPI | `8000` |
| `WHISPER_SERVICE_URL` | FastAPI | Endpoint interne de transcription | `http://127.0.0.1:8001/transcribe` |
| `MAX_AUDIO_BYTES` | FastAPI, Whisper | Taille maximale d’un fichier audio | `26214400` (25 Mio) |
| `WHISPER_TIMEOUT_SECONDS` | FastAPI | Temps maximal d’attente de Whisper | `180` |
| `WHISPER_MODEL` | Whisper | Modèle chargé par la bibliothèque Whisper | `tiny` |
| `NODE_ENV` | Next.js et code serveur TS | Mode développement/production | normalement géré par Next.js |

`PATH` est aussi lu puis complété en mémoire par `services/whisper_service.py` afin de rendre FFmpeg accessible. Ce n’est pas une variable métier à recopier dans `.env`.

## Règles sur les secrets

- `APP_ACCESS_KEY` et `AUTH_SECRET` doivent être longs, privés et différents.
- Les mêmes valeurs doivent être visibles par Next.js et FastAPI.
- En production, Next.js refuse les fallbacks si `NODE_ENV=production`.
- FastAPI exige les deux secrets si `ENV=production`.
- Modifier `AUTH_SECRET` invalide les cookies existants, ce qui est normal.
- Une variable préfixée `NEXT_PUBLIC_` serait exposée au navigateur ; aucun secret ne doit porter ce préfixe.

## Services et ports

### PostgreSQL — `5432`

Déclaré par `docker-compose.yml`. Le volume `life-regime-postgres` conserve les données après l’arrêt du conteneur.

### FastAPI — `8000`

Point d’entrée : `interface_API/run.py`. Le serveur charge `app.main:app` et active le rechargement automatique en développement.

Adresses utiles :

- santé : `http://127.0.0.1:8000/api/health` ;
- OpenAPI : `http://127.0.0.1:8000/docs`.

### Whisper — `8001`

Point d’entrée : `services/whisper_service.py`. C’est un service interne ; l’application passe par FastAPI, jamais directement depuis le navigateur.

### Next.js — `3000`

Point d’entrée : App Router sous `app/`. Next.js affiche l’interface et expose les routes same-origin sous `/api`.

## Scripts `package.json`

| Commande | Action |
| --- | --- |
| `pnpm dev` | Démarre seulement Next.js en développement |
| `pnpm start` | Démarre un build Next.js déjà produit |
| `pnpm build` | Produit le build de production Next.js |
| `pnpm typecheck` | Exécute TypeScript sans générer de fichiers |
| `pnpm test:api` | Lance les tests Python via le wrapper Windows |
| `pnpm check` | Enchaîne typecheck, tests API et build |
| `pnpm prisma:generate` | Régénère Prisma Client |
| `pnpm prisma:migrate --name <nom>` | Crée/applique une migration de développement |

## Scripts Windows sous `scripts/`

| Script | Rôle |
| --- | --- |
| `dev.ps1` / `dev.cmd` | Vérifie FastAPI, sonde/tente de démarrer Whisper, puis lance Next.js |
| `test-api.ps1` / `test-api.cmd` | Lance `unittest` dans `interface_API/tests` |
| `start-whisper-service.ps1` / `.cmd` | Démarre seulement Whisper |
| `pnpm.ps1` / `.cmd` | Wrapper pour le runtime Node fourni dans l’espace Codex |
| `prisma-generate.ps1` / `.cmd` | Wrapper de génération Prisma |
| `prisma-migrate.ps1` / `.cmd` | Wrapper de migration Prisma |

Les scripts d’orchestration visibles ciblent Windows. Aucune version Bash équivalente n’est présente pour Linux/macOS.

## Dépendances séparées

Il existe trois ensembles de dépendances :

1. `package.json` et `pnpm-lock.yaml` pour Next.js/React/Prisma ;
2. `interface_API/requirements.txt` pour l’API métier ;
3. `services/requirements.txt` pour Whisper.

L’environnement virtuel recommandé `interface_API/.venv` couvre l’API métier. Le script Whisper appelle actuellement `python` ; assurez-vous donc que les dépendances de `services/requirements.txt` sont installées pour cet interpréteur.

## Ordre de démarrage manuel

Si le script global ne convient pas :

1. PostgreSQL : `docker compose up -d` depuis la racine.
2. FastAPI : `python run.py` depuis `interface_API/`.
3. Whisper : `python -m uvicorn services.whisper_service:app --host 127.0.0.1 --port 8001` depuis la racine.
4. Next.js : `pnpm dev` depuis la racine.

Cet ordre facilite le diagnostic : chaque dépendance est prête avant son client.

## Configuration de production

Le dépôt vérifie certains secrets, mais ne contient pas de procédure de déploiement production. Sont notamment non documentés : reverse proxy, TLS, domaine, gestionnaire de secrets, CI/CD, sauvegardes, logs centralisés et supervision.

Toute production doit au minimum :

- fournir de vrais secrets hors du dépôt ;
- ne pas exposer PostgreSQL, FastAPI interne ou Whisper directement à Internet sans architecture explicite ;
- définir précisément `FRONTEND_ORIGINS` ;
- utiliser HTTPS pour que le cookie sécurisé fonctionne ;
- prévoir sauvegarde, restauration, migration et rollback ;
- vérifier les limites de ressources du modèle Whisper.

Ces recommandations ne constituent pas une procédure de déploiement existante ; cette procédure reste à concevoir et tester.
