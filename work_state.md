# État du travail

Dernière mise à jour : 2026-08-12

- Phase actuelle : vérification finale terminée.
- Page actuelle : toutes les pages validées sont traitées.
- Tâches en cours : aucune.
- Tâches terminées : audit, plan, validation ; Global / Interface ; To-Do ; Planning / Calendar ; Time Allocation ; Habits / Routines ; Notes / Thinking ; Daily Log ; Emotional.
- Blocages : migrations PostgreSQL non appliquées volontairement ; aucun accès à un sous-agent Luna Max dans cette session.
- Prochaine action : appliquer les migrations sur la base cible puis effectuer le smoke test navigateur connecté à cette base.

## Décisions validées

- `not_done` est un statut To-Do distinct, avec raison facultative.
- Le choix oui/non de description contrôle l'affichage du champ facultatif.
- Time Allocation conserve le jour et ajoute des périodes persistées semaine/mois.
- Habits propose des modèles de démarrage et des modèles personnels.
- Emotional utilise une entrée principale par semaine ISO.
- Les seuils du ratio Daily Log sont 0,25 / 0,50 / 0,75.
- La suppression globale d'un tag est limitée aux tags inutilisés ; les tags associés doivent d'abord être détachés.
- Emotional conserve une contrainte unique `(userId, weekId)` et utilise un upsert atomique.
