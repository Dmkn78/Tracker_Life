# Journal de réalisation

## 2026-08-09 — Audit et validation

- Lecture de l'architecture Next.js, FastAPI, Prisma/PostgreSQL et des pages concernées.
- Identification des composants, contrats API et modèles de données probablement concernés.
- Constat : les fichiers `task.md`, `work_state.md` et `log.md` n'existaient pas ; leur création a été incluse dans le plan.
- Constat : les thèmes clair/sombre existent, mais plusieurs composants emploient encore des couleurs sombres directes et aucun mode adaptatif ni système de traduction n'existe.
- Constat To-Do : l'éditeur reprend l'importance, mais le parcours de modification `medium` / `high` doit être fiabilisé et vérifié ; aucun statut distinct `not_done` ni navigation hebdomadaire n'est exposé.
- Constat Calendar : un calendrier FullCalendar riche existe déjà dans Life Terminal, alors que `/calendar` est une liste simple ; il sera réutilisé comme source de vérité.
- Constat Habits : durée et heure existent partiellement, mais pas de jours récurrents, modèles ni blocs de routine persistés complets.
- Constat Thinking : un tag peut déjà être détaché d'une note et l'API sait supprimer un tag, mais l'interface de suppression définitive manque.
- Constat Daily Log : l'upsert, le choix de date et la limite de trois existent partiellement ; le ratio visuel manque et l'édition doit devenir explicite.
- Constat Emotional : aucune fonctionnalité équivalente n'existe.
- Plan présenté page par page puis approuvé explicitement par l'utilisateur (`GREEN FLAG`).
- Lecture et application des skills `coding-rules` et `code-quality` ; consultation des références React/Next.js demandées par le skill de qualité.
- Tests exécutés à ce stade : aucun, car aucune modification applicative n'avait encore été faite.
- Prochaine étape : Global / Interface.

## 2026-08-09 — Global / Interface

- Conservation des palettes sombre et claire ; ajout des palettes plein soleil, faible éblouissement et soirée chaude.
- Ajout d'un mode adaptatif basé sur le thème/contraste système et, si disponible, le capteur de lumière ambiante, avec seuils nommés, repli déterministe et nettoyage des listeners.
- La luminosité physique de l'écran n'est pas lue : cette capacité n'est pas exposée de manière portable par les navigateurs.
- Ajout d'une fondation FR/EN typée et persistée ; traduction de la navigation globale, des contrôles d'apparence et de Settings.
- Ajout de tokens partagés et de règles mobiles, avec exclusion explicite des checkbox/radio compacts.
- Problèmes détectés en review puis corrigés : hydratation de la préférence, `color-scheme` des thèmes personnalisés, régression mobile des checkbox/radio, libellé Tracker, rerenders inchangés du capteur et intégration du test au gate principal.
- Tests ajoutés : résolution des palettes aux bornes 50/250/10 000 lux, absence/NaN, préférences média et fallback.
- Vérifications : `test:appearance` 3/3 réussi ; `typecheck` réussi ; build production réussi ; review finale `PASS`.
- Non vérifié visuellement : interactions réelles et persistance après rechargement, car aucun serveur local ne répondait pendant le smoke test borné.
- Avertissement conservé : Node signale `MODULE_TYPELESS_PACKAGE_JSON` pendant le test TypeScript direct ; il est non bloquant et la version minimale Node `>=22.6.0` est maintenant explicite.
- Prochaine étape : To-Do.

## 2026-08-09 — To-Do

- Correction du round-trip d'importance `medium` / `high` avec contrôle typé, initialisation exacte en édition et payload partagé.
- Ajout du choix description oui/non ; le choix non masque le champ, efface la valeur obsolète et envoie `null`.
- Ajout d'une vue semaine ISO lundi-dimanche avec précédent, suivant et semaine courante, utilisant les bornes API `from/to`.
- Ajout du statut persistant `not_done` et de `notDoneReason` dans React, FastAPI, SQLAlchemy et Prisma.
- Création de la migration additive `prisma/migrations/20260809120000_add_task_not_done_status/migration.sql`, volontairement non appliquée.
- Suppression de la troncature des titres ; mise en page multilignes et contrôles mobiles flexibles.
- Traduction complète de la page et de ses contrôles principaux en FR/EN.
- Ajout du drag-and-drop clavier, de groupes nommés et de `aria-pressed` centralisé.
- Correction de l'affichage des dates civiles dans les fuseaux UTC négatifs.
- Problème détecté en review puis corrigé : les jetons de mutations optimistes ne garantissaient pas un état confirmé lors d'un double échec. Remplacement par un coordinateur FIFO réellement branché, avec snapshot confirmé et projection des écritures pendantes, par tâche et pour le tri.
- Vérifications finales : `test:todo` 10/10 ; `test:api` 20/20 ; Prisma validate/generate réussis ; typecheck réussi ; build réussi ; review finale `PASS`.
- Non vérifié : clics et rendu responsive dans un navigateur ; persistance sur PostgreSQL cible ; migration non appliquée.
- Ordre de déploiement requis : appliquer la migration avant le backend, car SQLAlchemy lit la nouvelle colonne.
- Prochaine étape : Planning / Calendar.

## 2026-08-09 — Planning / Calendar

- Remplacement de la liste `/calendar` par une intégration FullCalendar partagée avec Life Terminal ; une seule instance applicative du moteur.
- Ajout des navigations précédent/suivant/aujourd'hui et des vues mois/semaine/jour.
- Chargement dynamique de la plage visible avec annulation, génération et garde de cycle de vie.
- Séparation des dates civiles To-Do et des instants exacts Events avec offsets ; requête backend par chevauchement semi-ouvert.
- Ajout des couches Events et To-Do, avec contrat prêt pour Allocations/Routines sans données fictives ; To-Do en lecture seule.
- CRUD, drag et resize des événements sérialisés ; ancienne lecture invalidée avant toute mutation puis rechargement après file idle.
- Ajout du bouton clavier, du dialogue natif modal, des labels, du focus et des adaptations mobiles.
- Chargement de la locale officielle FullCalendar française et traduction du wrapper Life Terminal.
- Mutualisation du coordinateur FIFO entre To-Do et Calendar sans supprimer les wrappers de compatibilité.
- Problèmes détectés et corrigés en review : lecture obsolète après mutation, offset/DST et chevauchements, accessibilité, locale, duplication, reload après unmount, double mutation du formulaire et contrat de plage fallback.
- Vérifications finales : `test:calendar` 10/10 ; `test:api` 23/23 ; `test:todo` 10/10 ; typecheck réussi ; build réussi ; review `PASS`.
- Non vérifié : rendu visuel navigateur, confort réel du scroll mobile et parcours E2E avec PostgreSQL.
- Prochaine étape : Time Allocation.

## 2026-08-12 — Time Allocation

- Conservation du modèle journalier et ajout de contextes/allocations persistés semaine et mois dans deux modèles additifs dédiés.
- Le réel semaine/mois est exclusivement agrégé depuis les allocations journalières, sans duplication.
- Ajout du sélecteur jour/semaine/mois, des ancres canoniques, de précédent/suivant/actuel et de la persistance de préférence sans écraser une query URL explicite.
- Synchronisation de la vue Par tâche et adaptation mobile des métriques, graphiques et cartes.
- Ajout de l'endpoint Calendar et de la couche Allocation all-day en lecture seule.
- Factorisation du plan effectif : plan manuel stocké ou plan automatique recalculé depuis budget et poids courants, partagé entre Portfolio et Calendar.
- Exclusion des catégories archivées des totaux réels visibles.
- Ajout de gardes synchrones et de protections de cycle de vie contre doubles mutations, changements de période et réponses obsolètes.
- Validation stricte des plafonds civils semaine/mois, dont février normal et bissextile.
- Migration additive `prisma/migrations/20260809170000_add_periodic_time_allocation/migration.sql` créée et non appliquée.
- Vérifications confirmées localement : `test:time-allocation` 5/5 ; `test:calendar` 11/11 ; `test:api` 35/35 ; typecheck réussi ; Prisma validate/generate et build précédemment réussis.
- Non vérifié : migration PostgreSQL cible, rendu navigateur et parcours E2E DB.
- Ordre de déploiement : migration, API, puis Next.
- Prochaine étape : Habits / Routines.

## 2026-08-12 — Habits / Routines

- Ajout de trois modèles de démarrage et de modèles personnels enregistrables/supprimables.
- Ajout d'une récurrence ISO sur un ou plusieurs jours, avec raccourcis lundi-vendredi et lundi-dimanche.
- Filtrage de la vue du jour et des statistiques selon la récurrence réelle.
- Ajout du time blocking : une habitude planifiée synchronise un bloc de routine, y compris lorsqu'il traverse minuit.
- Ajout de la couche Calendar `Routines`, visuellement distincte, temporisée et en lecture seule afin de préserver la lisibilité des To-Do.
- Ajout des champs Prisma/SQLAlchemy, du modèle `HabitTemplate` et de la migration additive `prisma/migrations/20260812100000_add_habit_schedules_templates/migration.sql`, non appliquée.
- Problème rencontré : le premier test de calcul d'heure de fin utilisait une construction dépendante du fuseau ; correction par calcul civil UTC déterministe.
- Vérifications : tests Habitudes 3/3, Calendar 12/12, API 39/39 lors de la première passe Habitudes ; Prisma generate/validate, typecheck et build réussis.
- Non vérifié : persistance PostgreSQL cible et rendu navigateur après migration.

## 2026-08-12 — Notes / Thinking

- Conservation du retrait d'un tag dans l'éditeur de note, avec libellé accessible FR/EN.
- Ajout d'un gestionnaire affichant chaque tag et son nombre d'utilisations.
- Suppression définitive autorisée uniquement pour un tag inutilisé ; l'API renvoie `409` si une tâche ou une note l'utilise encore.
- Verrouillage de la ligne du tag pendant la vérification/suppression afin d'éviter une suppression concurrente d'associations.
- Rechargement non bloquant des tags après création ou modification d'une note.
- Vérifications : typecheck, compilation Python, build et gate API réussis.
- Non vérifié : interaction réelle de confirmation et rendu du gestionnaire dans un navigateur connecté.

## 2026-08-12 — Daily Log

- Affichage explicite de la création d'une nouvelle entrée ou de la modification d'une entrée enregistrée.
- Exposition et affichage séparé de `createdAt` et de la date métier du journal.
- Les améliorations, blocages, priorités de demain et tags restent modifiables dans l'upsert existant.
- Limite de trois améliorations conservée dans l'interface et le contrat API.
- Ajout du ratio `travail / (travail + distraction)` et des seuils rouge `<0,25`, orange `<0,50`, jaune `<0,75`, vert `>=0,75`; le ratio `1` est vert.
- Ajout des traductions FR/EN pour le calendrier, l'état d'édition, les champs de bilan et les actions principales concernées.
- Vérifications : tests du ratio 2/2, tests API, typecheck et build réussis.
- Non vérifié : autosave et édition multi-date avec une base PostgreSQL migrée dans un navigateur réel.

## 2026-08-12 — Emotional

- Création de la route `/emotional`, de sa navigation FR/EN et de l'API `/api/emotional-reviews`.
- Ajout d'un bilan par semaine ISO, navigable, réouvrable et modifiable.
- Données prises en charge : émotions avec intensité 1-5, stress 0-100, facteurs, déclencheurs, signaux mentaux/physiques, aides, action suivante et notes.
- Conservation et affichage de `createdAt` / `updatedAt`.
- Upsert atomique garanti par la contrainte unique `(userId, weekId)`.
- Ajout du modèle Prisma/SQLAlchemy et de la migration additive `prisma/migrations/20260812140000_add_emotional_reviews/migration.sql`, non appliquée.
- Première vérification : une inférence TypeScript trop étroite sur l'état bilingue a échoué ; annotation explicite ajoutée, puis typecheck réussi.
- Vérifications : tests Emotional 2/2, validations API des semaines/intensités/stress, Prisma validate/generate, compilation Python, typecheck et build réussis.
- Non vérifié : persistance et parcours visuel avec la base PostgreSQL cible, car la migration n'a pas été appliquée.

## 2026-08-12 — Revue et contraintes d'exécution

- Revue locale complète selon `coding-rules` et `code-quality` : validation des responsabilités, erreurs, limites, portée utilisateur, courses de lecture/écriture et accessibilité des nouveaux contrôles.
- Aucun sous-agent supplémentaire n'a été utilisé : l'utilisateur interdit Sol/Terra et Luna Max n'est pas proposé par l'environnement de délégation actif.
- Les modifications préexistantes sans rapport (`.github/workflows/deploy.yml`, `scripts/deploy.sh`, `.claude/settings.local.json`, `RECAP_SESSION_2026-08-04.md`) ont été conservées et n'ont pas été revendiquées comme faisant partie de ce travail.
- Gate final `npm run check` réussi : typecheck, 37 tests front/domain, 41 tests API et build Next production.
- `prisma validate`, `prisma generate`, compilation Python et `git diff --check` réussis ; seuls les avertissements CRLF et `MODULE_TYPELESS_PACKAGE_JSON` non bloquants restent présents.
- Smoke test borné du serveur compilé réussi : `/login` répond `200` et `/emotional` répond `307` vers l'authentification ; le processus de test a ensuite été arrêté.
- Vérification de la contrainte de fichiers : aucun fichier suivi supprimé.
