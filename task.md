# Plan de travail approuvé

Dernière mise à jour : 2026-08-12

Légende : `[ ]` à faire, `[-]` en cours, `[x]` terminé, `[!]` bloqué ou partiellement vérifié.

## Global / Interface

- [x] Conserver les thèmes clair et sombre existants.
- [x] Ajouter plusieurs chartes visuelles adaptées aux conditions de visibilité.
- [x] Ajouter un mode adaptatif tenant compte, lorsque le navigateur le permet, du contraste, du thème système et de la lumière ambiante, avec un repli déterministe.
- [x] Améliorer fortement la lisibilité mobile et en forte luminosité.
- [x] Ajouter le français et l'anglais et mémoriser la préférence.

## To-Do

- [x] Corriger la sélection `medium` / `high` pendant la modification d'une tâche.
- [x] Remplacer le comportement ambigu de description par un choix oui/non qui affiche ou masque le champ facultatif.
- [x] Permettre la navigation entre les semaines.
- [x] Ajouter le statut distinct `not_done`.
- [x] Permettre une raison facultative lorsqu'une tâche n'est pas réalisée.
- [x] Afficher le nom complet des tâches sans troncature par `...`.

## Planning / Calendar

- [x] Permettre la navigation semaine précédente / suivante.
- [x] Améliorer l'allocation de temps sur mobile.
- [x] Permettre l'allocation par semaine ou par mois pour les tâches planifiées.
- [x] Réutiliser la logique de calendrier existante et éviter une seconde implémentation concurrente.
- [x] Proposer des couches lisibles pour les tâches, allocations et routines.

## Time Allocation

- [x] Conserver l'allocation journalière existante.
- [x] Ajouter une période persistée `week` et `month` avec ancrage de période.
- [x] Rendre l'édition et la synthèse utilisables sur mobile.
- [x] Exposer les allocations pertinentes au calendrier partagé.

## Habits / Routines

- [x] Ajouter des modèles de démarrage et des modèles personnels.
- [x] Supporter un ou plusieurs jours de récurrence.
- [x] Supporter notamment lundi-vendredi et lundi-dimanche.
- [x] Ajouter le time blocking des routines.
- [x] Afficher les routines dans une couche de calendrier distincte des To-Do.

## Notes / Thinking

- [x] Permettre de détacher un tag d'une note.
- [x] Permettre de supprimer définitivement un tag inutilisé.
- [x] Conserver la normalisation et les associations existantes.

## Daily Log

- [x] Rendre explicite la modification d'une entrée enregistrée.
- [x] Permettre la modification de `Top Three Things to Improve`, `Blockers`, `Tomorrow Priorities` et des tags.
- [x] Garantir au maximum trois éléments pour `Top Three Things to Improve` côté interface et API.
- [x] Afficher le ratio travail / divertissement avec quatre niveaux rouge, orange, jaune et vert.
- [x] Utiliser les seuils validés 0,25 / 0,50 / 0,75, avec `1` entièrement consacré au travail et affiché en vert.
- [x] Permettre un log pour une autre date tout en distinguant la date du log de `createdAt`.

## Emotional

- [x] Créer une section de bilan émotionnel, principalement hebdomadaire.
- [x] Limiter à une entrée principale par semaine ISO et permettre sa modification.
- [x] Enregistrer émotions et intensité (1-5), facteurs, stress (0-100), déclencheurs, signaux mentaux/physiques, aides, action de la semaine suivante et notes.
- [x] Conserver `createdAt` et `updatedAt`.
- [x] Ajouter la navigation et les traductions FR/EN.

## Validation

- [x] Audit effectué avant toute modification.
- [x] Plan présenté page par page.
- [x] Validation explicite reçue : `USER_APPROVAL = GREEN FLAG`.
- [x] Implémentation revue avec `coding-rules` et `code-quality`.
- [x] Tests, typecheck et build exécutés lorsque disponibles.
- [x] Vérification finale de toutes les tâches.
