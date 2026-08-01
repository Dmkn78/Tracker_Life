# Memoire de deploiement VPS - Life Regime Tracker

Date de contexte : 31 juillet 2026

## Objectif

Deployer le projet Life Regime Tracker sur une VPS.

Le projet contient :

- un frontend Next.js dans `H:\CYTECHDATA\Documents\interface` en local ;
- une API Python FastAPI dans `interface_API` ;
- une base PostgreSQL prevue via `docker-compose.yml` ;
- une configuration partagee via le fichier `.env` du dossier parent.

## Etat local connu

L'API Python se lance localement avec :

```powershell
cd H:\CYTECHDATA\Documents\interface\interface_API
.\.venv\Scripts\python.exe run.py
```

Elle expose normalement :

```text
http://127.0.0.1:8000
http://127.0.0.1:8000/docs
```

Le frontend se lance localement avec :

```powershell
cd H:\CYTECHDATA\Documents\interface
npm run dev
```

Il expose normalement :

```text
http://localhost:3000
```

## Situation sur la VPS

Pendant le deploiement VPS, la commande Docker a echoue avec :

```text
Command 'docker' not found, but can be installed with:
snap install docker         # version 29.3.1, or
apt  install docker.io      # version 29.1.3-0ubuntu4.1
apt  install podman-docker  # version 5.7.0+ds2-3build1
See 'snap info docker' for additional versions.
```

Conclusion : Docker n'est pas encore installe sur la VPS, donc la base PostgreSQL ne peut pas etre lancee avec `docker compose up -d`.

## Prochaine etape

Installer Docker sur la VPS, de preference via `apt` ou via le depot officiel Docker.

Option simple Ubuntu/Debian :

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
```

Ensuite, se deconnecter/reconnecter a la session SSH pour que le groupe `docker` soit pris en compte.

Verifier :

```bash
docker --version
docker compose version
```

## Relancer la base sur la VPS

Depuis le dossier racine du projet, la ou se trouve `docker-compose.yml` :

```bash
docker compose up -d
```

Verifier que PostgreSQL tourne :

```bash
docker ps
```

## Points a ne pas oublier

- Copier ou recreer le fichier `.env` sur la VPS.
- Verifier que `DATABASE_URL`, `APP_ACCESS_KEY` et `AUTH_SECRET` sont bien renseignes.
- Installer les dependances Python dans `interface_API`.
- Installer les dependances Node du frontend.
- Decider ensuite du mode de production :
  - API FastAPI via `uvicorn` ou service `systemd` ;
  - frontend Next.js via `npm run build` puis `npm start`, ou via `pm2`/`systemd` ;
  - reverse proxy Nginx si le site doit etre expose en HTTPS.

## Etat VPS mis a jour

- Docker a ete installe et PostgreSQL a demarre dans le conteneur `life-regime-postgres`.
- Le port PostgreSQL Docker a ete deplace sur `5433` car le port `5432` etait deja utilise sur la VPS.
- L'API FastAPI demarre correctement sur `127.0.0.1:8000`.
- Test API OK :

```text
{"ok":true,"usingDevAccessKey":false}
```

- Nginx repond depuis l'exterieur, mais a affiche `502 Bad Gateway` car le frontend Next.js ne tournait pas encore sur `127.0.0.1:3000`.
- `next start` a echoue car le build `.next` n'existait pas.
- `npm run build` compile, puis echoue sur TypeScript :

```text
TypeScript 7.0.2 does not provide the compiler API required by Next.js.
Enable experimental.useTypeScriptCli in your Next.js config to use the TypeScript CLI,
or install TypeScript 6 instead.
```

## Prochaine correction VPS

Depuis `/opt/interface_API`, remplacer TypeScript `latest` par une version compatible avec Next :

```bash
npm install -D typescript@6
npm run build
npx next start -H 127.0.0.1 -p 3000
```

Si `typescript@6` n'est pas disponible dans le registre utilise par la VPS, utiliser une version stable compatible :

```bash
npm install -D typescript@5.9
npm run build
```

## Blocage Next config

Apres correction TypeScript, le build peut echouer avec :

```text
Configuring Next.js via 'next.config.ts' is not supported.
Please replace the file with 'next.config.js'.
```

Le contenu local de `next.config.ts` est :

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "1mb"
    }
  }
};

export default nextConfig;
```

Equivalent a creer sur la VPS dans `/opt/interface_API/next.config.js` :

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "1mb"
    }
  }
};

module.exports = nextConfig;
```

Puis renommer ou supprimer `next.config.ts`, relancer `npm run build`, puis `npx next start -H 127.0.0.1 -p 3000`.
