# Maintenance et règles de code

Ce document fixe les règles à suivre pour ne pas recréer l’ancienne confusion entre interface, API et base de données.

## Principe central : une seule source de vérité

- Logique métier persistante : FastAPI, sous `interface_API/app/core` et `routers`.
- Schéma et migrations : `prisma/schema.prisma` et `prisma/migrations`.
- Contrat d’entrée HTTP Python : `interface_API/app/contracts`.
- Type métier frontend : `features/<feature>/domain`.
- Validation d’une réponse HTTP : `features/<feature>/api`.
- Composant et interaction : `features/<feature>/components`.
- Infrastructure réellement partagée : `lib/` ou `components/`.

Avant de créer un élément, cherchez son équivalent avec `rg`. Une deuxième définition presque identique est souvent plus dangereuse qu’un module un peu plus général.

## Règles de nommage

Un nom doit être précis et facilement recherchable.

- Composant React : `PascalCase`, par exemple `ObjectiveWeeklyPlanner`.
- Fonction/variable TypeScript : `camelCase`, par exemple `parseHistoryData`.
- Fonction/variable Python : `snake_case`, par exemple `get_history_data`.
- Constante : nom descriptif ; `UPPER_SNAKE_CASE` est utilisé en Python et pour certaines constantes TS de module.
- Fichier de composant : même nom que le composant principal.
- Fichier de domaine : nom métier singulier ou intention claire.
- Éviter `data`, `item`, `helper`, `utils2`, `new`, `temp`, `manager` sans contexte.

Un nom public modifié est un changement de contrat. Recherchez tous ses consommateurs avant de le renommer.

## Types explicites aux frontières

- Une fonction publique TypeScript annonce son entrée et son retour.
- Une réponse réseau commence comme `unknown`, jamais comme un cast confiant.
- Une requête FastAPI utilise un modèle Pydantic au lieu d’un dictionnaire libre.
- Une fonction qui peut échouer définit une erreur stable ou laisse remonter une erreur déjà normalisée.
- `null`, champ absent et chaîne vide ne doivent pas être confondus par accident.

Les implémentations locales évidentes peuvent laisser l’inférence travailler. Le but n’est pas d’annoter chaque caractère, mais de rendre les contrats visibles.

## Un fichier, une responsabilité principale

Un fichier peut contenir plusieurs fonctions si elles servent le même rôle. Il doit être possible de compléter la phrase : « Ce fichier existe pour… » avec une seule idée principale.

Signaux d’extraction :

- composant très long mêlant formulaire, visualisation et transformation de données ;
- routeur mélangeant calcul complexe et détails HTTP ;
- même parser ou constante copié dans plusieurs fichiers ;
- fonction demandant beaucoup de paramètres sans objet métier clair ;
- commentaires nécessaires pour distinguer plusieurs sous-systèmes dans le même fichier.

N’extrayez pas une fonction uniquement pour réduire le nombre de lignes. Une extraction doit créer une frontière compréhensible.

## Règles frontend

1. Aucun `fetch` brut dans un composant.
2. Un composant appelle le module `api/` de sa feature.
3. Le module API utilise `requestJson` et valide la réponse.
4. Le domaine ne dépend pas de React ou HTTP.
5. Une page serveur utilise `requireUser()` puis `requestInternalApiJson` pour ses données initiales.
6. Un appel navigateur utilise une route proxy Next same-origin.
7. Une opération concurrente doit accepter/propager un signal d’annulation.
8. Une mise à jour optimiste doit disposer d’un rollback.
9. L’état dérivé doit être calculé, pas dupliqué dans plusieurs `useState`.
10. Les styles d’une nouvelle feature doivent rester visibles au scanner Tailwind.

## Règles des proxies Next.js

Une route `app/api/<domaine>/route.ts` métier doit être mince :

- constante de chemin FastAPI ;
- une fonction par méthode autorisée ;
- délégation à `proxyApiRequest` ;
- aucune requête Prisma ;
- aucun calcul métier ;
- aucun format d’erreur divergent.

Exceptions actuelles : les routes Next d’authentification créent/suppriment le cookie navigateur et utilisent donc `lib/auth.ts`.

## Règles backend

1. Le contrat Pydantic valide la syntaxe et les bornes.
2. Le routeur orchestre authentification, ownership et résultat HTTP.
3. Le calcul réutilisable appartient à `core/`.
4. Toutes les requêtes liées à un utilisateur filtrent par `userId`.
5. Une référence reçue (`objectiveId`, `habitId`, etc.) est vérifiée avant liaison.
6. Une commande multi-enregistrements reste dans la transaction de la requête.
7. Préférer un upsert protégé par contrainte unique à `SELECT` puis `INSERT`.
8. Une erreur publique ne contient pas le texte brut d’une exception interne.
9. Les dates utilisent les fonctions centralisées de `core/dates.py`.
10. Les règles d’arrondi devant reproduire JavaScript utilisent `javascript_round`.

## Règles base de données

- Prisma possède les migrations.
- SQLAlchemy mappe le schéma sans le créer.
- Une modification verticale inclut schéma, migration, mapping, contrat, sérialisation, parseur et tests.
- Une suppression doit préciser : physique, archivage ou désactivation.
- Une opération destructive exige une sauvegarde et un plan de retour vérifiés.
- Les index et contraintes uniques font partie du comportement, pas seulement des performances.

## Ajouter une fonction proprement

1. Formuler son unique responsabilité en une phrase.
2. Choisir le module propriétaire de cette responsabilité.
3. Rechercher une fonction existante qui couvre déjà le besoin.
4. Nommer selon l’intention, pas selon l’implémentation.
5. Définir des paramètres peu nombreux et précis.
6. Éviter de muter un argument sauf convention explicite.
7. Garder les appels externes aux frontières ; une fonction pure est plus facile à tester.
8. Traiter les cas vides et erreurs attendues.
9. Ajouter un test ciblé si le comportement porte une règle.
10. Vérifier les consommateurs et exécuter les contrôles.

Exemple de décision : un calcul de score sans base ni HTTP appartient à `core/metrics.py`. Une fonction qui transforme le JSON de ce score en type TypeScript appartient au module API de la feature, pas au composant.

## Créer ou modifier un fichier

Avant de créer :

- déterminer la couche propriétaire ;
- choisir un nom stable et recherchable ;
- vérifier qu’un fichier existant n’a pas déjà cette responsabilité ;
- prévoir qui importe ce fichier et ce qu’il peut importer.

Après création :

- limiter les exports à ce qui est réellement public ;
- éviter une dépendance circulaire ;
- ajouter le fichier à la documentation s’il devient architecturalement important ;
- vérifier son inclusion par TypeScript, Tailwind ou Python selon son type.

Lors d’un déplacement, mettre à jour tous les imports puis supprimer l’ancienne source. Ne laissez pas un ancien fichier et son remplaçant diverger.

## Ajouter une route complète : checklist verticale

- [ ] Besoin et contrat public écrits.
- [ ] Méthode HTTP et chemin choisis sans collision.
- [ ] Table/migration Prisma si nécessaire.
- [ ] Mapping SQLAlchemy aligné.
- [ ] Contrat Pydantic avec bornes et alias.
- [ ] Règle métier dans `core/` si réutilisable.
- [ ] Routeur court, authentifié et filtré par ownership.
- [ ] Réponse stable en `camelCase`.
- [ ] Module domain TypeScript adapté.
- [ ] Parseur de réponse `unknown` adapté.
- [ ] Fonction d’appel dans le module API de feature.
- [ ] Proxy Next uniquement pour le navigateur.
- [ ] Composant avec loading, annulation et erreur.
- [ ] Tests ciblés.
- [ ] Documentation des routes et fichiers mise à jour.
- [ ] `pnpm check` réussi.

## Modifier un contrat API sans surprise

Un contrat inclut plus que le chemin : méthode, query, corps, valeurs par défaut, casse des noms, nullabilité, codes d’erreur et forme de réponse.

Pour un changement compatible, ajouter d’abord un champ optionnel et rendre le parseur tolérant à son absence si une transition est nécessaire. Pour un changement cassant, identifier explicitement tous les consommateurs et documenter l’impact avant modification.

Ne changez jamais uniquement :

- un enum Pydantic sans le type TypeScript ;
- un nom JSON sans le parser ;
- un type de date sans les fonctions de normalisation ;
- un statut d’erreur utilisé par l’interface ;
- le format du cookie dans une seule implémentation.

## Commentaires

Un bon commentaire explique une contrainte ou une raison non évidente : compatibilité Prisma, parité d’arrondi, sécurité, limitation externe.

Un commentaire ne doit pas répéter le code. Si le code nécessite un paragraphe pour expliquer ce qu’il fait, préférez souvent un meilleur nom ou une extraction.

## Appels externes et concurrence

- Toujours définir un timeout.
- Propager l’annulation quand l’utilisateur change de vue ou de filtre.
- Limiter la taille des uploads avant l’appel externe.
- Normaliser l’erreur du service externe.
- Ne pas supposer qu’une réponse `200` contient un JSON valide.
- Limiter la concurrence des traitements lourds, comme Whisper.
- Concevoir les retries seulement pour des opérations idempotentes.

## Définition de « terminé »

Une modification est terminée lorsque :

- la responsabilité est au bon endroit ;
- l’ancien code dupliqué est supprimé ;
- le contrat reste cohérent de la base au composant ;
- les erreurs et cas limites sont traités ;
- les tests pertinents existent ;
- `pnpm check` passe ;
- la documentation reflète le nouvel état ;
- aucun changement utilisateur sans rapport n’a été écrasé.

## Revue rapide avant intégration

- Le diff contient-il seulement les changements nécessaires ?
- Une feature importe-t-elle une autre feature sans raison architecturale ?
- Un composant contient-il `fetch`, Prisma ou une règle métier persistante ?
- Une route backend vérifie-t-elle l’utilisateur propriétaire ?
- Une réponse externe est-elle traitée comme `unknown` ?
- Un secret ou une URL interne est-il exposé au navigateur ?
- Un nouveau champ est-il présent dans toutes les couches nécessaires ?
- Les dates et arrondis conservent-ils leur sémantique ?
- Les fichiers supprimés ont-ils encore des imports ?
- Les docs et tests correspondent-ils au code actuel ?
