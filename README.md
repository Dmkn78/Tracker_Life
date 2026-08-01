# Life Regime Tracker

Life Regime Tracker est une application personnelle de suivi quotidien. Elle réunit journal de journée, tâches, calendrier, habitudes, objectifs, allocation du temps, historique, indicateurs de trajectoire et transcription vocale locale.

Le projet est organisé en quatre processus ou services :

- l’interface web Next.js/React sur le port `3000` ;
- l’API métier FastAPI sur le port `8000` ;
- le service local Whisper sur le port `8001` ;
- PostgreSQL sur le port `5432`.

FastAPI est la source unique de logique métier. Next.js rend l’interface, gère le cookie de session du navigateur et expose des proxies same-origin très minces. Prisma possède le schéma et les migrations PostgreSQL ; SQLAlchemy permet à FastAPI d’utiliser ce même schéma.

## Par où commencer ?

La documentation complète se trouve dans [`docs/README.md`](docs/README.md).

- Première installation : [`docs/01-DEBUTER.md`](docs/01-DEBUTER.md)
- Notions de programmation : [`docs/02-FONDAMENTAUX-DU-CODE.md`](docs/02-FONDAMENTAUX-DU-CODE.md)
- Architecture : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Guide de maintenance : [`docs/08-MAINTENANCE-ET-REGLES.md`](docs/08-MAINTENANCE-ET-REGLES.md)

## Démarrage local rapide sous Windows

1. Copier `.env.example` vers `.env` et remplacer les secrets d’exemple.
2. Démarrer PostgreSQL avec `docker compose up -d`.
3. Installer les dépendances avec `pnpm install` puis créer la base avec `pnpm prisma:migrate --name init`.
4. Installer les dépendances Python décrites dans le guide de démarrage.
5. Lancer l’ensemble avec `.\scripts\dev.ps1` ou `.\scripts\dev.cmd`.

La commande de vérification globale est :

```powershell
pnpm check
```

Elle exécute le contrôle TypeScript, les tests de l’API Python et le build de production Next.js.

> En développement uniquement, l’absence de `APP_ACCESS_KEY` active la clé `dev-access-key`. Cette valeur ne doit jamais protéger de vraies données ni être utilisée en production.
