# Base de données : PostgreSQL, Prisma et SQLAlchemy

## Les trois noms à distinguer

**PostgreSQL 16** est le moteur qui stocke réellement les lignes sur disque.

**Prisma 6.19.3** décrit le schéma et produit les migrations. Son client TypeScript est encore utilisé pour l’utilisateur local et la session Next.js.

**SQLAlchemy 2.0.51** permet à FastAPI de lire et modifier ces mêmes tables. Il ne possède pas les migrations dans ce projet.

Il n’existe donc qu’une base de données et un seul schéma, vus par deux bibliothèques.

## Source de vérité du schéma

La source de vérité est `prisma/schema.prisma`.

- `prisma/migrations/` conserve l’historique SQL versionné ;
- `prisma generate` génère le client TypeScript ;
- `prisma migrate dev` applique et crée les migrations en développement ;
- `interface_API/app/models.py` doit reproduire les tables pour SQLAlchemy ;
- FastAPI ne doit pas appeler `Base.metadata.create_all()` pour contourner Prisma.

## Exemple de table Prisma

Extrait réel simplifié à la partie centrale du modèle `Task` :

```prisma
model Task {
  id        String @id @default(cuid())
  userId    String
  user      User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  title     String
  date      DateTime @db.Date
}
```

Explication ligne par ligne :

1. `model Task {` commence la définition de la table logique `Task`.
2. `id` est une chaîne, clé primaire, créée par défaut au format CUID.
3. `userId` stocke l’identifiant du propriétaire.
4. `user` décrit la relation vers `User` ; supprimer l’utilisateur supprime ses tâches grâce à `Cascade`.
5. `title` est une chaîne obligatoire.
6. `date` est manipulé comme `DateTime` par Prisma mais stocké comme date PostgreSQL sans heure.
7. `}` termine le modèle.

Erreur fréquente : ajouter seulement un champ dans Prisma ne suffit pas. Sans migration, la colonne n’existe pas ; sans mapping SQLAlchemy, FastAPI ne la connaît pas ; sans contrat/parser, l’API et le frontend ne peuvent pas l’échanger proprement.

## Tables actuelles

| Modèle | Rôle | Relations ou invariants importants |
| --- | --- | --- |
| `User` | Utilisateur local unique dans l’usage actuel | propriétaire de toutes les données ; préférences calories/sommeil |
| `DailyLog` | Journal d’une journée | unique par `(userId, date)` ; scores calculés ; date SQL |
| `Task` | Tâche planifiée | objectif optionnel ; index par utilisateur/date et utilisateur/objectif |
| `CalendarEvent` | Contrainte ou événement | début/fin avec heure ; impact, stress et charge |
| `Habit` | Définition d’une habitude | peut avoir des check-ins et blocs de routine ; désactivation logique |
| `HabitCheckin` | Réalisation d’une habitude un jour donné | unique par `(userId, habitId, date)` |
| `RoutineBlock` | Bloc horaire de routine | habitude optionnelle ; type de journée et ordre |
| `TimeAllocationCategory` | Catégorie du portefeuille de temps | poids, rendement attendu, risque, beta, couleur |
| `DailyTimeAllocation` | Temps prévu/réel d’une catégorie à une date | unique par `(userId, categoryId, date)` |
| `DailyPlanningContext` | Budget total d’une journée | unique par `(userId, date)` |
| `Objective` | Objectif/projet/milestone hiérarchique | arbre parent/enfants ; archivage logique ; tâches et blocs liés |
| `WeeklyPlanBlock` | Bloc du planning hebdomadaire | objectif optionnel ; date, horaires et durée |
| `WeeklyReport` | Instantané JSON d’un rapport hebdomadaire | unique par `(userId, weekId)` |

## Enums

Le schéma définit les familles de valeurs fermées suivantes :

- `DailyLogStatus` ;
- `TaskImportance` et `TaskStatus` ;
- `CalendarEventType` et `CalendarImpact` ;
- `ObjectiveKind`, `ObjectiveHorizon`, `ObjectiveStatus`, `ObjectivePriority` ;
- `WeeklyPlanCategory`.

Les valeurs sont généralement majuscules en base (`DONE`, `HIGH`) mais certaines réponses JSON les exposent en minuscules (`done`, `high`). Les contrats Pydantic sont insensibles à la casse pour ces enums. Ne changez pas cette conversion sur une seule couche.

## Relations importantes

- Toutes les données persistantes appartiennent à un `User`.
- Une `Task` peut pointer vers un `Objective` ; supprimer/archiver l’objectif détache la tâche.
- Un `Objective` peut avoir un parent et plusieurs enfants ; le routeur empêche les cycles.
- Un `WeeklyPlanBlock` peut pointer vers un objectif.
- Un `HabitCheckin` doit correspondre à une habitude de l’utilisateur courant.
- Une `DailyTimeAllocation` doit correspondre à une catégorie du même utilisateur.

Le contrôle d’ownership ne doit jamais reposer uniquement sur l’identifiant fourni. Une requête doit chercher la ressource avec son `id` **et** le `userId` de la session.

## Session SQLAlchemy et transaction

`interface_API/app/database.py` crée un moteur et une fabrique de sessions. Pour chaque requête qui dépend de `get_db()` :

1. une session s’ouvre ;
2. le routeur et les fonctions `core` travaillent dans cette même session ;
3. `db.flush()` peut envoyer les changements afin d’obtenir des identifiants sans valider définitivement ;
4. à la fin sans erreur, `db.commit()` valide toute la requête ;
5. en cas d’exception, `db.rollback()` annule l’ensemble ;
6. `db.close()` libère toujours la connexion.

Ne faites pas un `commit()` au milieu d’une opération multi-enregistrements sauf besoin explicitement justifié. Vous perdriez l’atomicité : la moitié d’une commande pourrait rester enregistrée après une erreur.

## Upsert et contraintes uniques

Un upsert met à jour une ligne si sa clé unique existe et l’insère sinon. Il est utilisé pour les données « une ligne par utilisateur/date/catégorie ».

Pourquoi ? Une séquence « SELECT puis INSERT » permet à deux requêtes concurrentes de conclure toutes les deux que la ligne n’existe pas. La contrainte unique et l’upsert déplacent cette décision vers PostgreSQL.

## Modifier le schéma sans casser l’application

Exemple : ajouter une note optionnelle à `Task`.

1. Modifier `prisma/schema.prisma`, par exemple avec un nom précis `note String?`.
2. Créer une migration nommée : `pnpm prisma:migrate --name add_task_note`.
3. Lire le SQL généré avant de l’appliquer à des données importantes.
4. Régénérer le client : `pnpm prisma:generate`.
5. Ajouter la colonne correspondante à la classe `Task` de `interface_API/app/models.py`.
6. Ajouter le champ aux contrats Pydantic concernés avec le bon comportement absent/null.
7. Mettre à jour la sérialisation du routeur ou du `core`.
8. Mettre à jour le type et le parseur `features/todo/domain` / `features/todo/api`.
9. Modifier l’interface seulement après la continuité de ce contrat vertical.
10. Ajouter des tests de contrat, de lecture/écriture et d’ownership.
11. Exécuter `pnpm check`.

## Migration et données existantes

Avant une migration destructive ou une contrainte plus stricte :

- mesurer les valeurs existantes incompatibles ;
- prévoir une valeur par défaut ou une migration de données ;
- sauvegarder la base selon une procédure vérifiée ;
- définir une stratégie de rollback réaliste ;
- tester sur une copie avant la production.

Le dépôt ne contient actuellement ni procédure de sauvegarde/restauration ni procédure de rollback. C’est une lacune documentée, pas une fonctionnalité implicite.

## Docker local

`docker-compose.yml` lance :

- l’image `postgres:16` ;
- la base `life_regime_tracker` ;
- l’utilisateur local `postgres` ;
- le port hôte `5432` ;
- le volume persistant `life-regime-postgres`.

Les identifiants Docker présents conviennent à un environnement local isolé, pas à une production.

## Erreurs fréquentes

- Modifier `models.py` sans migration Prisma.
- Laisser `schema.prisma` et `models.py` diverger sur le nom ou le type d’une colonne.
- Supprimer une relation sans décider du comportement `Cascade`, `SetNull` ou refus.
- Utiliser une date-heure quand le contrat exige une date `YYYY-MM-DD`.
- Oublier une contrainte unique nécessaire à un upsert.
- Retourner une ligne appartenant à un autre utilisateur.
- Supprimer un volume Docker en pensant seulement arrêter le serveur.
- Exécuter une migration de développement directement sur une base importante sans sauvegarde.
