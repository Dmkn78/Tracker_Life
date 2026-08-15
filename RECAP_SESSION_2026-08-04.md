# Récapitulatif complet — Session du 2026-08-04/05

Ce document résume tout ce qui a été fait sur le projet **Life Regime Tracker** lors de cette session, pour permettre à une nouvelle conversation (avec un autre agent ou une autre IA) de reprendre avec le contexte complet, sans avoir à tout redécouvrir.

---

## 1. Le projet

**Stack** :
- Frontend : Next.js 16 (App Router, TypeScript, Tailwind CSS 3), architecture *feature-sliced* (`features/<nom>/{api,domain,components}`)
- Base de données : PostgreSQL, schéma géré par **Prisma** (`prisma/schema.prisma` + migrations)
- Backend additionnel : **FastAPI** (Python) dans `interface_API/`, qui lit/écrit **la même base Postgres** via des modèles SQLAlchemy synchronisés à la main sur le schéma Prisma (`interface_API/app/models.py`). Next.js n'a aucune logique métier propre : les routes `app/api/*` ne font que proxier vers FastAPI (`lib/server/proxyApiRequest.ts`).
- Authentification : cookie de session signé HMAC, partagé entre Next.js (`lib/auth.ts`) et FastAPI (`interface_API/app/security.py`), avec le même secret (`AUTH_SECRET`/`APP_ACCESS_KEY`).
- Service optionnel : transcription audio Whisper (`services/whisper_service.py`), port 8001.

**Dépôt GitHub** : `https://github.com/Dmkn78/Tracker_Life.git`, branche `main`.

**VPS de production** :
- Chemin réel du projet : **`/opt/interface_API`** (⚠️ le README documente `/opt/life-regime-tracker`, c'est **faux** pour ce VPS — ne pas s'y fier).
- Utilisateur : `ubuntu`
- **Pas de systemd, pas de pm2, pas de Docker.** L'app tourne via des process bruts lancés manuellement en SSH avec `nohup ... &` puis `disown`. C'est fragile : si le VPS reboote, rien ne redémarre automatiquement.
- FastAPI écoute sur `127.0.0.1:8000`, Next.js (`next start`) sur `127.0.0.1:3000`.
- Logs redirigés vers `/opt/interface_API/logs/` (⚠️ `/var/log/` n'est pas accessible en écriture pour l'utilisateur `ubuntu`, ne pas y écrire).
- La base Postgres est locale au VPS (`127.0.0.1:5432`), nom probable `postgres` ou `life_regime_tracker` selon le `.env`.
- Pas de Nginx/HTTPS confirmé actif — le site semble accessible en HTTP direct (voir section 8, `COOKIE_SECURE`).

---

## 2. Demande initiale (cahier des charges)

L'utilisateur a demandé, sans casser l'existant :
1. **Todo** : réorganisation des tâches (drag-and-drop + boutons, persisté en base), formulaire corrigé (nom obligatoire, description qui ne doit **jamais** créer plusieurs tâches, tags/date/heures/allocation/entreprise facultatifs), deux modes de création (tâche unique / création multiple avec lignes activables).
2. **Thinking Notes** : nouvelle fonctionnalité de notes (titre, texte, tags, date de création, rappel facultatif, lien vers une ou plusieurs tâches), rappels visibles clairement, pas de fausse notification système.
3. **Summary Log Day** : champs structurés (3 choses à améliorer, réussites, blocages, priorités du lendemain, tags, champs personnalisables), persistés et exploitables par API pour une IA future.
4. **Calendrier** : les tâches planifiées (date+heure) doivent apparaître automatiquement dans le calendrier, sans dupliquer les données entre Todo et Calendar.
5. **Allocation de temps** : champ typé (pas du texte), vues hebdo/mensuelle/par tag/par entreprise sur mobile.
6. **Entreprise** : notion structurée, liée aux tâches et au calendrier, filtrage, tag visuel.
7. **Thèmes clair/sombre** : lisibilité en plein soleil, couleurs centralisées dans des tokens/variables, pas de couleurs éparpillées dans les composants.
8. **Mobile** : toutes les nouvelles fonctionnalités adaptées, pas de dépendance au survol souris, pas de débordement horizontal, cibles tactiles suffisantes.
9. **Pipeline CI/CD** : GitHub → VPS, avec vérifications qualité, tests, build, migrations contrôlées, déploiement SSH, redémarrage ciblé, healthcheck, verrou anti-concurrence, stratégie de rollback minimale.

---

## 3. Ce qui a été implémenté (tout committé et poussé sur `origin/main`)

### Lot 0 — Fondations base de données
- Nouveaux modèles Prisma : `Company`, `Tag`, `TaskTag` (jointure), `ThinkingNote`, `ThinkingNoteTag`, `ThinkingNoteTask`.
- `Task` étendu : `description`, `startTime`, `endTime`, `sortOrder`, `companyId`, relation `tags`, `date` devenu **optionnel**.
- `CalendarEvent` étendu : `companyId`.
- `DailyLog` étendu : `wins`, `topImprovements`, `blockers`, `tomorrowPriorities`, `tags` (tableaux de strings), `customFields` (JSON).
- Migrations Prisma ajoutées :
  - `20260804184658_add_company_tags_thinking_notes_task_fields`
  - `20260804184751_backfill_task_sort_order` (recalcule l'ordre des tâches existantes pour préserver l'affichage actuel)
- Miroir SQLAlchemy mis à jour (`interface_API/app/models.py`), nouveaux contracts Pydantic (`companies.py`, `tags.py`, `thinking_notes.py`), nouveaux routers FastAPI (`companies.py`, `tags.py`, `thinking_notes.py`).

### Lot 1 — Todo
- Bug corrigé : une description multi-lignes ne crée plus plusieurs tâches (c'était le bug d'origine : le champ "titre" splittait le texte par ligne).
- Formulaire à deux modes : **Tâche unique** (tous les champs) et **Création multiple** (lignes avec case à cocher, indépendantes).
- Réorganisation : drag-and-drop (`@dnd-kit`) + boutons haut/bas toujours visibles (44px sur mobile), persisté via `Task.sortOrder` et `PATCH /api/tasks/reorder`.
- Suppression de tâche ajoutée (`DELETE /api/tasks`, absent avant).
- Fichiers clés : `features/todo/**`, `app/api/tasks/reorder/route.ts`, `interface_API/app/routers/tasks.py`.

### Lot 2 — Calendrier fusionné
- Les tâches planifiées (avec date) apparaissent automatiquement dans `/calendar`, fusionnées **en lecture seule** avec les `CalendarEvent` — aucune duplication de données (pas de copie de la tâche dans une nouvelle table).
- `CalendarEventForm` a gagné un champ entreprise.
- Fichiers clés : `features/calendar/**`, `components/CalendarEventForm.tsx`.

### Lot 3 — Allocation de temps par tâche
- Nouvel onglet "By task" dans `/time-allocation` : répartition hebdomadaire/mensuelle par tag et par entreprise, calculée depuis `Task.estimatedMinutes` (champ typé existant, pas du texte).
- Système `TimeAllocationCategory`/`DailyTimeAllocation` (portefeuille) inchangé, c'est une vue additionnelle.
- Fichiers clés : `interface_API/app/core/task_time_breakdown.py`, `features/time-allocation/components/TaskTimeBreakdownPanel.tsx`.

### Lot 4 — Thinking Notes (nouvelle fonctionnalité complète)
- CRUD complet, tags partagés, rappel optionnel, liaison à une ou plusieurs tâches.
- Rappels en retard mis en évidence visuellement (badge rouge). Aucune notification système simulée — seul le champ `reminderAt` existe en base, prêt pour un futur système de notification réel.
- Nouvelle route `/thinking`, entrée de nav ajoutée dans `components/AppShell.tsx`.
- Fichiers clés : `features/thinking-notes/**`, `app/thinking/page.tsx`.

### Lot 5 — Summary Log Day structuré
- Ajout de `wins`, `topImprovements` (max 3), `blockers`, `tomorrowPriorities`, `tags`, `customFields` (paires clé/valeur libres) — sans supprimer les champs existants.
- Fichiers clés : `features/daily-log/**`.

### Lot 6 — Thème clair/sombre
- Palette convertie en variables CSS (`--color-*`) dans `app/globals.css`, référencées par `tailwind.config.ts` via `rgb(var(--color-x) / <alpha-value>)`.
- Bascule via `next-themes` (`app/layout.tsx`), bouton dans la sidebar (`components/AppShell.tsx`), accessible desktop et mobile.
- Thème sombre = valeurs identiques à l'avant (aucune régression visuelle). Thème clair = nouvelles valeurs pensées pour la lisibilité en plein soleil.
- Balayage des couleurs en dur effectué sur tous les composants partagés (`components/ui.tsx`, `AppShell.tsx`, `ScoreCard.tsx`, `SliderField.tsx`, `DurationInput.tsx`, `TagCompanyFields.tsx`, `CalendarEventForm.tsx`) et les écrans touchés par les autres lots. Les écrans non touchés (Life Terminal, Objectives, Habits) restent en dark-only pour l'instant, volontairement hors périmètre.
- ⚠️ **Bug rencontré et corrigé** : `next-themes` avec `value={{dark: ""}}` provoque un crash (`classList.add("")` invalide). Corrigé en retirant ce mapping personnalisé.

### Lot 7 — Mobile
- Vérifié sur tous les écrans touchés : pas de débordement horizontal, cibles tactiles ≥44px, drawer de nav mobile inclut "Thinking" et le bouton thème.

### Lot 8 — Pipeline CI/CD
- Fichiers créés : `.github/workflows/deploy.yml`, `scripts/deploy.sh`.
- Solution retenue : **runner GitHub hébergé + déploiement SSH** (`appleboy/ssh-action`), pas de runner auto-hébergé.
- Déclenché sur `push` vers `main`. Verrou anti-concurrence : `concurrency` GitHub Actions + `flock` côté VPS dans `deploy.sh`.
- **⚠️ Ce pipeline n'est pas actif** — les secrets GitHub (`VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_SSH_PORT`) ne sont pas configurés, et `scripts/deploy.sh` suppose un chemin `/opt/life-regime-tracker` et des services **systemd** (`life-api`, `life-whisper`, `life-web`) qui **n'existent pas** sur ce VPS. **Ne pas configurer les secrets et activer ce pipeline tel quel** sans d'abord adapter `deploy.sh` au vrai chemin (`/opt/interface_API`) et à la vraie méthode de démarrage (voir section 7).

### Correctif supplémentaire — `COOKIE_SECURE`
- Le VPS sert le site en **HTTP simple** (pas de domaine/TLS configuré). Le cookie de session avait `secure: true` en production, ce que les navigateurs rejettent hors HTTPS → connexion impossible.
- Corrigé proprement (au lieu d'un hack en dur) : nouvelle variable d'environnement optionnelle `COOKIE_SECURE` dans `lib/auth.ts` et `interface_API/app/security.py`/`config.py`. Mettre `COOKIE_SECURE="false"` dans **les deux** fichiers `.env` (racine et `interface_API/.env`) tant que le site n'a pas de HTTPS.
- Documenté dans `.env.example` et `interface_API/.env.example`.

---

## 4. Fichiers principaux modifiés/ajoutés

```
prisma/schema.prisma + 2 migrations
interface_API/app/{models.py, contracts/*, routers/*, core/tags_companies.py, core/task_time_breakdown.py}
interface_API/app/{config.py, security.py}          ← COOKIE_SECURE
lib/auth.ts                                          ← COOKIE_SECURE
features/todo/**, features/calendar/**, features/time-allocation/**
features/thinking-notes/**  (nouveau)
features/daily-log/**
features/shared/{api,domain}/{companiesApi,tagsApi,tagCompany}.ts  (nouveau, partagé)
components/{ui.tsx, AppShell.tsx, TagCompanyFields.tsx (nouveau), CalendarEventForm.tsx, ScoreCard.tsx, SliderField.tsx, DurationInput.tsx}
app/{layout.tsx, globals.css, thinking/page.tsx (nouveau)}
tailwind.config.ts
.env.example, interface_API/.env.example
.github/workflows/deploy.yml, scripts/deploy.sh
package.json (ajout dnd-kit, next-themes, packageManager)
```

---

## 5. Commits de cette session

- `e62fc24` — "Amélioration des features" (l'essentiel du travail ci-dessus, committé et poussé par l'utilisateur directement)
- `cfcf05d` — "Rend le flag Secure du cookie de session configurable (COOKIE_SECURE)" (poussé avec confirmation explicite de l'utilisateur)

Les deux sont sur `origin/main`.

---

## 6. Tests exécutés (en local, avant push)

- Backend : `python -m unittest discover -s tests -v` → **17/17 OK**
- `tsc --noEmit` → clean
- `pnpm build` (production, en local) → succès, toutes les routes compilées
- Vérification manuelle en navigateur de chaque fonctionnalité (création tâche simple/multiple/description, réorganisation+refresh, tâche avec horaire→calendrier, édition/suppression, tags/entreprise, allocation semaine/mois, note Thinking, Summary Log Day, thèmes clair/sombre, mobile) — données de test nettoyées après chaque vérification.

---

## 7. Chronologie du déploiement VPS (important pour comprendre l'état actuel)

1. Premier `git pull` sur le VPS a échoué (branches divergentes) → **rien n'a été perdu**, juste bloqué.
2. Investigation : le VPS avait un commit local (`538a73b`, jamais poussé) contenant un hack `secure: false` en dur dans `lib/auth.ts` (fait par une IA lors d'une session précédente, pour contourner le problème HTTPS) + un `package.json`/`pnpm-lock.yaml` corrompu suite à un `pnpm install` cassé.
3. `git reset --hard origin/main` effectué sur le VPS pour repartir sur une base propre (le hack `secure:false` a été remplacé par le vrai correctif `COOKIE_SECURE`, donc rien d'utile perdu).
4. `COOKIE_SECURE="false"` ajouté dans les deux `.env`.
5. Séquence complète exécutée avec succès :
   ```bash
   pnpm install --frozen-lockfile
   pnpm prisma generate
   pnpm prisma migrate deploy      # "No pending migrations" au premier essai, puis a appliqué les migrations après le reset
   pnpm build                       # succès, toutes les nouvelles routes présentes
   cd interface_API && .venv/bin/pip install -r requirements.txt
   ```
6. Process relancés manuellement (pas de systemd) :
   ```bash
   pkill -f "uvicorn app.main:app" || true
   pkill -f "next start" || true
   cd /opt/interface_API/interface_API
   nohup .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 > ../logs/life-api.log 2>&1 & disown
   cd /opt/interface_API
   nohup pnpm start > logs/life-web.log 2>&1 & disown
   ```
7. Vérifications locales sur le VPS OK : `curl http://127.0.0.1:8000/api/health` → `{"ok":true}`, `curl -I http://127.0.0.1:3000` → `307` vers `/login` (normal).

## 8. ⚠️ PROBLÈME ACTUEL NON RÉSOLU

**Symptôme** : le site s'affiche en HTML brut, **sans aucun style CSS/Tailwind appliqué** (police par défaut du navigateur, pas de mise en page, pas de couleurs, liens bleus soulignés). Voir capture d'écran fournie par l'utilisateur — la page "Home" se charge, les liens de navigation et le contenu texte sont bien présents, mais zéro style.

**Ce que ça veut dire** : le HTML est généré correctement (donc Next.js répond, l'app fonctionne côté serveur), mais le fichier CSS compilé par Tailwind (`_next/static/css/*.css`) n'est probablement pas chargé par le navigateur.

**Pistes à vérifier en priorité par la prochaine session** :
1. **Reverse proxy / Nginx** : si un Nginx est en place devant le site, vérifier sa config pour `location /_next/static/` — un mauvais `proxy_pass` ou un cache agressif peut bloquer ces assets. Si pas de Nginx, comment le site est-il exposé publiquement (le port 3000 est-il ouvert directement) ?
2. **Cache navigateur/CDN** : tester en navigation privée ou avec un hard refresh (Ctrl+Shift+R) pour éliminer un cache de l'ancien HTML/CSS.
3. **Build ID mismatch** : si l'ancien process Next.js n'a pas été complètement tué avant le nouveau build+restart, il peut y avoir un décalage entre le HTML servi (ancien) et les assets statiques attendus (nouveaux) ou l'inverse. Revérifier qu'il n'y a qu'**un seul** process `next start` actif : `ps aux | grep "next start"`.
4. Vérifier directement dans le navigateur (onglet Réseau/Network) si la requête vers le fichier CSS renvoie une 404 ou une erreur — c'est le diagnostic le plus direct.
5. Vérifier que `.next/static` existe bien et contient les fichiers CSS après le build : `ls -la /opt/interface_API/.next/static/css/`.

**Ce n'est pas un problème de données** : rien n'indique que la base de données ou les migrations soient en cause ici, c'est un problème de service des fichiers statiques.

---

## 9. Secrets GitHub à configurer (si le pipeline CI/CD est activé un jour)

`VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_SSH_PORT` (optionnel). **Ne pas les configurer maintenant** — `scripts/deploy.sh` doit d'abord être adapté (chemin réel `/opt/interface_API`, pas de systemd disponible → soit installer systemd proprement, soit adapter le script aux commandes `nohup` manuelles).

---

## 10. Prochaines étapes suggérées

1. **Urgent** : résoudre le problème de CSS non chargé (section 8).
2. Mettre en place systemd pour `life-api` et `life-web` (fichiers d'unité documentés dans `README.md`, à adapter au chemin réel `/opt/interface_API`) — évite de revivre la galère de redémarrage manuel.
3. Une fois systemd en place, adapter `scripts/deploy.sh` au chemin réel et éventuellement activer le pipeline CI/CD.
4. Envisager HTTPS (domaine + certbot) pour pouvoir repasser `COOKIE_SECURE` à `true`.
5. Nettoyer `package-lock.json` resté sur le VPS (fichier npm parasite dans un projet pnpm).
