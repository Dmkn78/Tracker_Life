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
