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

Un contrôle vert indique que le code est validé. Il ne signifie pas que le VPS a changé de version. Il ne compile pas non plus un APK natif Android.

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

La procédure complète Ubuntu reste dans le README. Le script `scripts/deploy.sh` est destiné à une installation existante avec les services `life-api` et `life-web`, les environnements privés et la base configurés. Son exécution sur le VPS est distincte du merge GitHub. Le déploiement automatique pourra être relié au serveur lorsque son accès aura été configuré explicitement.
