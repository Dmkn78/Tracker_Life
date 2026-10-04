# Branches et production

La production utilise le code de `main` sur un VPS Ubuntu. Le dépôt conserve l’historique des commits et des merges ; aucune réécriture forcée n’est nécessaire.

## Circuit à utiliser

1. Développer et pousser sur `dev_branch`.
2. Ouvrir une pull request avec **base: main** et **compare: dev_branch**.
3. Attendre le contrôle **Web, mobile and PostgreSQL tests**.
4. Fusionner la pull request dans `main`.
5. Synchroniser `dev_branch` avec `main` si nécessaire.
6. Déployer `main` sur le VPS par la procédure Ubuntu existante.

Une PR avec **base: dev_branch** et **compare: main** ne publie pas les fonctionnalités en production : elle ne fait que remettre la branche de développement à jour. Une PR déjà fusionnée n’a pas besoin d’être recréée dans le sens inverse.

## Ce que garantit GitHub Actions

Le workflow `.github/workflows/ci.yml` teste les pushes sur `main` et `dev_branch`, ainsi que les PR vers `main`. Il applique toutes les migrations à une base PostgreSQL éphémère et exécute les tests d’intégration, puis les builds Next.js et mobile et `cap sync android`.

Le job de validation teste aussi la segmentation audio, le packaging et les classes Android avec Java 21 et le SDK 36. Après validation d’un push sur `main` ou `dev_branch`, le job `Publish signed Android update` appelle `.github/workflows/android-release.yml` pour publier une APK signée et son manifeste dans GitHub Releases. Une pull request ne publie aucune APK.

La clé persistante doit être configurée dans les quatre secrets Android décrits dans [android.md](android.md). Une clé manquante fait échouer explicitement la publication. Le serveur API doit être déployé avec `MOBILE_GITHUB_REPOSITORY` et un `MOBILE_GITHUB_TOKEN` privé limité à la lecture du dépôt pour proposer ces releases au téléphone.

Un contrôle vert ne signifie pas que le VPS a changé de version. La publication Android et le déploiement web/API sont distincts.

L’ancien workflow IIS a été retiré : il ciblait un autre système et pouvait ignorer entièrement le déploiement tout en terminant en succès. Aucun runner, secret de connexion ou adresse du VPS n’est requis pour les contrôles actuels.

## Récupérer les changements

Sur un clone propre déjà positionné sur `main` :

```bash
git status --short
git fetch origin
git pull --ff-only origin main
git rev-parse HEAD
```

Si des changements locaux ou une divergence empêchent le pull, les examiner avant de continuer ; ne pas utiliser de reset ou de push forcé. Mettre à jour Git ne reconstruit pas l’application et ne redémarre pas les services.

La procédure complète Ubuntu reste dans le README. Le script `scripts/deploy.sh` est destiné à une installation existante avec les services `interface-api-backend` et `life-web` (remplaçables par `API_SERVICE` et `WEB_SERVICE`), les environnements privés et la base configurés. Son exécution sur le VPS est distincte du merge GitHub. Le déploiement automatique pourra être relié au serveur lorsque son accès aura été configuré explicitement.

## Vérifier une livraison pour le téléphone

Le site doit publier `/mobile-app/release.json`, `/mobile-app/index.html` et ses fichiers JavaScript/CSS, ainsi que `/api/mobile-update` et l'APK référencée. Une réponse correcte de la page de connexion ne suffit pas. `scripts/deploy.sh` vérifie désormais ces ressources et le même identifiant de build pour le site en cours d'exécution et l'interface mobile. Lorsqu'une APK est publiée, le contrôle la télécharge et vérifie son SHA256 et sa taille avant de valider le déploiement.

Pour la première mise en service des mises à jour, publier d'abord une APK signée compatible. L'API peut utiliser la release GitHub avec sa configuration privée, ou une copie locale de l'APK nommée par son SHA256 dans `.runtime/mobile-release/` (ou `MOBILE_RELEASE_DIR`). Pour cette seconde option, ne pas configurer `MOBILE_GITHUB_REPOSITORY` : cette variable sélectionne le fournisseur GitHub. Copier `release.json` en dernier, après l'APK, pour éviter une publication incomplète. Aucune clé de signature n'est nécessaire sur le VPS.

Sur un VPS déjà configuré avec les services attendus :

```bash
cd /opt/interface_API
REQUIRE_ANDROID_UPDATE=1 bash scripts/deploy.sh origin/main
python3 scripts/verify-mobile-publication.py https://ADRESSE_DU_SITE --require-apk
```

`REQUIRE_ANDROID_UPDATE=1` fait échouer le contrôle si aucune APK n'est proposée. `WEB_HEALTH_URL` permet de vérifier une origine différente de `http://127.0.0.1:3000`, notamment l'adresse publique derrière Nginx. Le contrôle détecte aussi une interface provenant d'un ancien build, des assets manquants, un HTML de connexion servi à la place du JavaScript et une APK trop ancienne pour l'interface publiée. Les tests du contrôleur se lancent avec `python -m unittest discover -s scripts -p test_verify_mobile_publication.py`.

Le mot de passe de connexion à l'application ne donne pas accès au déploiement. Un accès SSH valide au VPS reste nécessaire pour mettre à jour le code, les fichiers publiés et les processus serveur.
