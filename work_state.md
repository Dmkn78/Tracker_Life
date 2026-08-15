# État du travail

Dernière mise à jour : 2026-08-15

- Phase actuelle : audit et préparation CI/CD Windows/IIS.
- Page actuelle : pipeline de déploiement.
- Tâches en cours : finaliser le pipeline fail-closed et la documentation VM.
- Tâches terminées : audit, plan, validation ; Global / Interface ; To-Do ; Planning / Calendar ; Time Allocation ; Habits / Routines ; Notes / Thinking ; Daily Log ; Emotional.
- Blocages : migrations PostgreSQL non appliquées volontairement ; aucun accès à un sous-agent Luna Max dans cette session ; l'application actuelle utilise encore des fonctions serveur Next.js et ne produit pas d'export statique `out/`, donc une migration applicative est requise avant le premier déploiement IIS statique.
- Prochaine action : migrer l'interface vers un export statique, puis pousser `main` pour déclencher le workflow.

## Décisions validées

- `not_done` est un statut To-Do distinct, avec raison facultative.
- Le choix oui/non de description contrôle l'affichage du champ facultatif.
- Time Allocation conserve le jour et ajoute des périodes persistées semaine/mois.
- Habits propose des modèles de démarrage et des modèles personnels.
- Emotional utilise une entrée principale par semaine ISO.
- Les seuils du ratio Daily Log sont 0,25 / 0,50 / 0,75.
- La suppression globale d'un tag est limitée aux tags inutilisés ; les tags associés doivent d'abord être détachés.
- Emotional conserve une contrainte unique `(userId, weekId)` et utilise un upsert atomique.
