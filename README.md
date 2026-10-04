# Life Regime Tracker

Life Regime Tracker est une application personnelle de suivi quotidien. Elle réunit journal de journée, tâches, calendrier, habitudes, objectifs, allocation du temps, historique, indicateurs de trajectoire et transcription vocale locale.

Le projet utilise les composants suivants :

- l’interface web Next.js/React sur le port `3000` ;
- l’API métier FastAPI sur le port `8000` ;
- un processus local Parakeet V3 multilingue lancé par l’API pour chaque transcription ;
- PostgreSQL sur le port `5432`.

## GitHub et production Ubuntu

La production utilise un VPS Ubuntu. Les modifications passent de `dev_branch` vers `main` par une pull request. Le workflow [`ci.yml`](.github/workflows/ci.yml) vérifie TypeScript, JavaScript, API/PostgreSQL, audio, builds web/mobile et tests Android. Les pushes validés publient ensuite une APK signée dans GitHub Releases lorsque la clé persistante est configurée dans les secrets. Les [mises à jour Android](docs/android.md) passent par l’API du serveur. Le workflow ne déploie pas sur le VPS. Voir le [circuit Git et production](docs/production-git.md).

FastAPI est la source unique de logique métier. Next.js rend l’interface, gère le cookie de session du navigateur et expose des proxies same-origin très minces. Prisma possède le schéma et les migrations PostgreSQL ; SQLAlchemy permet à FastAPI d’utiliser ce même schéma.

## Par où commencer ?

La documentation complète se trouve dans [`docs/README.md`](docs/README.md).

- Première installation : [`docs/01-DEBUTER.md`](docs/01-DEBUTER.md)
- Notions de programmation : [`docs/02-FONDAMENTAUX-DU-CODE.md`](docs/02-FONDAMENTAUX-DU-CODE.md)
- Architecture : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Guide de maintenance : [`docs/08-MAINTENANCE-ET-REGLES.md`](docs/08-MAINTENANCE-ET-REGLES.md)
- Performance, capital fictif et rewards : [`docs/performance-mvp.md`](docs/performance-mvp.md)
- Objectifs, roadmap, exécution, prévisions et mode crème : [`docs/objectives-planning.md`](docs/objectives-planning.md)
- Assistant local LM Studio, dictée de tâches et analyses : [`docs/lm-studio-assistant.md`](docs/lm-studio-assistant.md)

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

## Déployer sur un VPS Ubuntu, depuis zéro

Ce guide suppose un VPS Ubuntu 22.04 ou 24.04, un nom de domaine qui pointe vers le VPS, et un dépôt Git contenant ce projet. Remplace partout :

- `TON_IP_VPS` par l’adresse IP du serveur ;
- `ton-domaine.fr` par ton domaine ;
- `TON_URL_GIT` par l’URL Git du projet ;
- les secrets d’exemple par de vraies valeurs longues et privées.

L’application aura quatre services :

- Next.js/React sur `127.0.0.1:3000` ;
- FastAPI sur `127.0.0.1:8000` ;
- Parakeet V3, lancé à la demande sans port supplémentaire ;
- PostgreSQL sur `127.0.0.1:5432`.

Nginx recevra les visiteurs sur Internet et redirigera vers Next.js. Les ports internes `3000`, `8000`, `8001` et `5432` ne doivent pas être ouverts publiquement.

### 1. Se connecter au VPS

Depuis ton ordinateur :

```bash
ssh root@TON_IP_VPS
```

Mets le serveur à jour :

```bash
apt update
apt upgrade -y
```

Installe les outils de base :

```bash
apt install -y git curl unzip build-essential nginx postgresql postgresql-contrib python3 python3-venv python3-pip ffmpeg
```

Installe Node.js 22 et `pnpm` :

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
corepack enable
corepack prepare pnpm@latest --activate
```

Vérifie que les commandes existent :

```bash
node -v
pnpm -v
python3 --version
psql --version
nginx -v
```

### 2. Télécharger le projet

Place le projet dans `/opt` :

```bash
cd /opt
git clone TON_URL_GIT life-regime-tracker
cd /opt/life-regime-tracker
```

Si le projet est déjà téléchargé sur le serveur :

```bash
cd /opt/life-regime-tracker
git pull
```

### 3. Créer la base PostgreSQL

Connecte-toi à PostgreSQL :

```bash
sudo -u postgres psql
```

Dans le terminal PostgreSQL, crée l’utilisateur et la base :

```sql
CREATE USER life_user WITH PASSWORD 'REMPLACE_PAR_UN_MOT_DE_PASSE_LONG';
CREATE DATABASE life_regime_tracker OWNER life_user;
GRANT ALL PRIVILEGES ON DATABASE life_regime_tracker TO life_user;
\q
```

Teste la connexion :

```bash
psql "postgresql://life_user:REMPLACE_PAR_UN_MOT_DE_PASSE_LONG@127.0.0.1:5432/life_regime_tracker"
```

Quitte avec :

```sql
\q
```

### 4. Configurer les variables d’environnement

Crée le fichier `.env` à la racine :

```bash
cp .env.example .env
nano .env
```

Mets au minimum ceci, en remplaçant les valeurs :

```env
DATABASE_URL="postgresql://life_user:REMPLACE_PAR_UN_MOT_DE_PASSE_LONG@127.0.0.1:5432/life_regime_tracker?schema=public"
APP_ACCESS_KEY="REMPLACE_PAR_UNE_CLE_PRIVEE_TRES_LONGUE"
AUTH_SECRET="REMPLACE_PAR_UN_SECRET_TRES_LONG_ALEATOIRE"
INTERNAL_API_URL="http://127.0.0.1:8000"
ENV="production"
FRONTEND_ORIGINS="https://ton-domaine.fr"
API_HOST="127.0.0.1"
API_PORT="8000"
WHISPER_SERVICE_URL="http://127.0.0.1:8001/transcribe"
MAX_AUDIO_BYTES="26214400"
WHISPER_TIMEOUT_SECONDS="180"
WHISPER_MODEL="tiny"
```

Pour générer deux secrets propres :

```bash
openssl rand -base64 48
openssl rand -base64 48
```

Le premier peut servir à `APP_ACCESS_KEY`, le second à `AUTH_SECRET`.

Crée aussi le `.env` de l’API :

```bash
cp interface_API/.env.example interface_API/.env
nano interface_API/.env
```

Mets les mêmes valeurs importantes que dans le `.env` racine :

```env
DATABASE_URL="postgresql://life_user:REMPLACE_PAR_UN_MOT_DE_PASSE_LONG@127.0.0.1:5432/life_regime_tracker?schema=public"
APP_ACCESS_KEY="REMPLACE_PAR_UNE_CLE_PRIVEE_TRES_LONGUE"
AUTH_SECRET="REMPLACE_PAR_UN_SECRET_TRES_LONG_ALEATOIRE"
WHISPER_SERVICE_URL="http://127.0.0.1:8001/transcribe"
FRONTEND_ORIGINS="https://ton-domaine.fr"
API_HOST="127.0.0.1"
API_PORT="8000"
ENV="production"
MAX_AUDIO_BYTES="26214400"
WHISPER_TIMEOUT_SECONDS="180"
```

Sauvegarde dans `nano` avec `Ctrl+O`, puis `Entrée`, puis quitte avec `Ctrl+X`.

### 5. Installer les dépendances React/Next.js

À la racine du projet :

```bash
cd /opt/life-regime-tracker
pnpm install --frozen-lockfile
pnpm prisma generate
pnpm prisma migrate deploy
pnpm build
```

Si `pnpm install --frozen-lockfile` échoue parce que le lockfile n’est pas synchronisé, utilise :

```bash
pnpm install
```

puis relance :

```bash
pnpm prisma generate
pnpm prisma migrate deploy
pnpm build
```

### 6. Installer les dépendances Python de FastAPI

```bash
cd /opt/life-regime-tracker/interface_API
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate
```

Teste l’API :

```bash
cd /opt/life-regime-tracker/interface_API
source .venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Dans un deuxième terminal SSH :

```bash
curl http://127.0.0.1:8000/api/health
```

Tu dois voir une réponse proche de :

```json
{"ok":true,"usingDevAccessKey":false}
```

Arrête le serveur de test avec `Ctrl+C`.

### 7. Installer Parakeet V3 multilingue

Depuis la racine du dépôt, avec Python 3.12 ou plus récent :

```bash
python3 scripts/install-parakeet.py
```

Le script crée `.runtime/parakeet-venv` et télécharge le modèle CPU quantifié, dont il vérifie le SHA256. Aucun service Whisper ni application de bureau Handy n’est nécessaire : l’API utilise directement le modèle Parakeet V3. Prévoir de la mémoire disponible pour l’inférence ; le processus se termine après chaque transcription.

Dans les logs, **Dicter le résumé** démarre le microphone ; **Arrêter et transcrire** ajoute le texte au résumé existant. Le résumé reste facultatif. La durée est limitée à 30 minutes et les fichiers à 100 Mo. L’audio est décodé sur disque puis transcrit par segments de 20 secondes avec chevauchement. Une seule transcription s’exécute à la fois ; la progression est consultée par requêtes courtes, avec annulation et nettoyage des fichiers temporaires. Garder le journal ouvert pendant le traitement : une tâche sans suivi pendant trois minutes est arrêtée, et les résultats expirent dix minutes après la fin. Les tâches sont interrompues lors du redémarrage de l’API. Pour un déploiement existant, définir `MAX_AUDIO_BYTES=104857600` et autoriser `client_max_body_size 101M` dans Nginx. L’import audio utilise le même modèle. Le microphone du navigateur nécessite HTTPS ou localhost et une autorisation de l’utilisateur.

Les chemins peuvent être remplacés par `PARAKEET_PYTHON` et `PARAKEET_MODEL_DIR`. Le délai maximal utilise le réglage existant `WHISPER_TIMEOUT_SECONDS` (180 secondes par défaut).

### 8. Créer les services systemd

`systemd` permet de lancer automatiquement l’interface et les API au démarrage du VPS.

Crée le service FastAPI :

```bash
nano /etc/systemd/system/life-api.service
```

Colle ceci :

```ini
[Unit]
Description=Life Regime Tracker FastAPI
After=network.target postgresql.service

[Service]
Type=simple
WorkingDirectory=/opt/life-regime-tracker/interface_API
EnvironmentFile=/opt/life-regime-tracker/interface_API/.env
ExecStart=/opt/life-regime-tracker/interface_API/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Crée le service Next.js :

```bash
nano /etc/systemd/system/life-web.service
```

Avant de coller le service, récupère le chemin exact de `pnpm` :

```bash
which pnpm
```

Si la commande affiche par exemple `/usr/bin/pnpm`, colle ceci :

```ini
[Unit]
Description=Life Regime Tracker Next.js Web
After=network.target life-api.service

[Service]
Type=simple
WorkingDirectory=/opt/life-regime-tracker
EnvironmentFile=/opt/life-regime-tracker/.env
ExecStart=/usr/bin/pnpm start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Si `which pnpm` affiche un autre chemin, remplace `/usr/bin/pnpm` dans `ExecStart` par le chemin exact. Par exemple, si la commande affiche `/usr/local/bin/pnpm`, utilise :

```ini
ExecStart=/usr/local/bin/pnpm start
```

Active et lance les services :

```bash
systemctl daemon-reload
systemctl enable life-api life-web
systemctl start life-api
systemctl start life-web
```

Vérifie leur état :

```bash
systemctl status life-api
systemctl status life-web
```

Tu peux quitter l’écran de statut avec `q`.

### 9. Configurer Nginx

Crée la configuration du site :

```bash
nano /etc/nginx/sites-available/life-regime-tracker
```

Colle ceci :

```nginx
server {
    listen 80;
    server_name ton-domaine.fr;

    client_max_body_size 30M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_read_timeout 200s;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Active le site :

```bash
ln -s /etc/nginx/sites-available/life-regime-tracker /etc/nginx/sites-enabled/life-regime-tracker
nginx -t
systemctl reload nginx
```

Teste dans le navigateur :

```text
http://ton-domaine.fr
```

### 10. Ajouter HTTPS avec Let’s Encrypt

Installe Certbot :

```bash
apt install -y certbot python3-certbot-nginx
```

Crée le certificat HTTPS :

```bash
certbot --nginx -d ton-domaine.fr
```

Quand Certbot demande s’il faut rediriger HTTP vers HTTPS, accepte la redirection.

Vérifie le renouvellement automatique :

```bash
certbot renew --dry-run
```

Ton application doit maintenant être accessible ici :

```text
https://ton-domaine.fr
```

### 11. Commandes utiles au quotidien

Voir les logs de l’interface React/Next.js :

```bash
journalctl -u life-web -f
```

Voir les logs de l’API FastAPI :

```bash
journalctl -u life-api -f
```

Redémarrer après une modification :

```bash
systemctl restart life-api
systemctl restart life-web
```

Mettre à jour le projet depuis Git :

```bash
cd /opt/life-regime-tracker
git pull
pnpm install --frozen-lockfile
pnpm prisma generate
pnpm prisma migrate deploy
pnpm build
systemctl restart life-api
systemctl restart life-web
```

Tester les ports internes :

```bash
curl http://127.0.0.1:3000
curl http://127.0.0.1:8000/api/health
```

### 12. Pare-feu minimal

Si `ufw` est actif ou si tu veux l’activer :

```bash
apt install -y ufw
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
ufw status
```

N’ouvre pas PostgreSQL ou FastAPI sur Internet. Ils doivent rester en local sur `127.0.0.1`.

### 13. Problèmes fréquents

Si le site affiche une erreur 502, vérifie que Next.js tourne :

```bash
systemctl status life-web
journalctl -u life-web -n 100
```

Si l’interface charge mais que les données ne fonctionnent pas, vérifie FastAPI :

```bash
curl http://127.0.0.1:8000/api/health
journalctl -u life-api -n 100
```

Si la transcription vocale ne fonctionne pas, vérifie les logs de l’API et l’installation de Parakeet :

```bash
journalctl -u life-api -n 100
python3 scripts/install-parakeet.py
```

Si la base de données refuse la connexion, vérifie `DATABASE_URL` dans `.env` et `interface_API/.env`, puis teste :

```bash
psql "postgresql://life_user:REMPLACE_PAR_UN_MOT_DE_PASSE_LONG@127.0.0.1:5432/life_regime_tracker"
```

Si tu changes une variable d’environnement, redémarre les services :

```bash
systemctl restart life-api life-web
```

## Android — Life Regime

La version 1.0.7 conserve une interface pensée pour le téléphone (cinq onglets, paramètres, notification des tâches) et utilise les API du site. Le build du site publie également cette interface mobile pour la mettre à jour sans refaire sa présentation. Une version intégrée reste disponible si la publication est inaccessible. Voir [le guide Android](docs/android.md) pour la migration, les mises à jour et la compilation.

```powershell
npm run build
npx cap sync android
npx cap open android
```
