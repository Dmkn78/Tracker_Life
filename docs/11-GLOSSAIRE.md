# Glossaire pour débutant

Les exemples cités viennent du projet. Pour une progression guidée avec extraits expliqués ligne par ligne, lire [`02-FONDAMENTAUX-DU-CODE.md`](02-FONDAMENTAUX-DU-CODE.md).

## API

Une **API** est un contrat de communication entre programmes. Ici, le frontend demande des données à FastAPI avec des requêtes HTTP. L’ensemble des chemins `/api/...`, de leurs entrées et de leurs réponses constitue l’API.

## Backend

Le **backend** traite les règles et les données hors de l’écran de l’utilisateur. Le backend métier de ce projet est sous `interface_API/app/` et utilise FastAPI, Pydantic, SQLAlchemy et PostgreSQL.

## Base de données

Une **base de données** stocke durablement des informations structurées. PostgreSQL conserve ici les journaux, tâches, événements, habitudes, objectifs et réglages. Fermer le navigateur ne supprime pas ces données.

## Booléen

Un **booléen** possède deux valeurs : vrai ou faux. TypeScript/JSON écrivent `true` et `false`; Python écrit `True` et `False`. `trainingDone` est un exemple de booléen métier.

## Classe

Une **classe** définit une famille d’objets et leurs comportements. `Settings` dans `config.py`, les modèles Pydantic et les modèles SQLAlchemy sont des classes Python. Une classe Pydantic n’est pas une table : elle valide une entrée HTTP.

## Client et serveur

Le **client** envoie une demande ; le **serveur** y répond. Le navigateur est client de Next.js. Next.js est ensuite client de FastAPI. FastAPI est client de PostgreSQL et du service Whisper.

## Composant React

Un **composant** est une fonction ou unité React qui décrit une partie de l’interface. `TodoList` affiche une liste ; `TodoClient` orchestre davantage l’état et les interactions.

## Constante

Une **constante** est un nom qui ne doit pas être réassigné. `DEFAULT_REQUEST_TIMEOUT_MS` centralise par exemple la durée par défaut du client HTTP. Une constante nommée évite un « nombre magique » répété.

## Cookie

Un **cookie** est une petite valeur que le navigateur conserve et renvoie au serveur. `life_regime_session` contient un payload signé. `httpOnly` empêche le JavaScript de la page de lire sa valeur.

## CORS

**CORS** contrôle quelles origines web peuvent appeler une API depuis un navigateur. FastAPI utilise `FRONTEND_ORIGINS`. CORS ne remplace pas l’authentification.

## Corps de requête

Le **corps** transporte les données principales d’un `POST` ou `PATCH`, généralement en JSON. Créer une tâche envoie son titre, sa date et ses propriétés dans le corps.

## Date civile et date-heure

Une **date civile** comme `2026-07-31` ne contient ni heure ni fuseau. Une **date-heure ISO** peut contenir heure et fuseau. Les confondre peut déplacer une donnée au jour précédent ou suivant.

## Dépendance

Une **dépendance** est un module ou service nécessaire à un autre. `TodoClient` dépend de `todoApi`; FastAPI dépend de PostgreSQL. Les dépendances doivent pointer vers des couches plus fondamentales, pas former un cercle.

## Endpoint

Un **endpoint** est un point précis d’une API, généralement méthode + chemin. `GET /api/tasks` et `POST /api/tasks` sont deux endpoints même s’ils partagent le chemin.

## Enum

Une **enum** limite une valeur à une liste fermée. Une importance de tâche est `LOW`, `MEDIUM` ou `HIGH` en base. Elle ne peut pas devenir une chaîne arbitraire sans modifier le contrat.

## Erreur

Une **erreur** peut être prévue ou imprévue. `422` est un refus prévu de validation ; `401` signale une session invalide ; `500` signale une exception interne. L’interface doit montrer un message utile sans révéler les détails sensibles du serveur.

## FastAPI

**FastAPI** est le framework Python de l’API principale. Il associe des fonctions à des routes HTTP, injecte l’utilisateur et la session DB, valide les données avec Pydantic et génère OpenAPI sous `/docs`.

## Fichier

Un **fichier** est une unité enregistrée sur disque. Son emplacement donne son rôle : un fichier sous `features/todo/domain` ne devrait pas effectuer un appel réseau.

## Frontend

Le **frontend** est l’interface destinée à l’utilisateur. Il comprend ici Next.js, React, TypeScript, Tailwind, `app/`, `features/` et `components/`.

## Fonction

Une **fonction** regroupe une opération nommée. `parseHistoryData` transforme une réponse inconnue validée en donnée utilisable. `get_history_data` assemble le read model côté Python.

## HMAC

**HMAC** produit une signature à partir d’un message et d’un secret. Le cookie est accepté seulement si Next.js et FastAPI recalculent la même signature. HMAC détecte une modification mais ne chiffre pas le contenu.

## HTTP

**HTTP** est le protocole utilisé pour les requêtes et réponses web. Les éléments principaux sont méthode, URL, en-têtes, corps et code de statut.

## Import

Un **import** rend disponible un symbole défini dans un autre module. `from .config import get_settings` importe une fonction Python ; `import { requestJson } from "@/lib/http/apiClient"` fait l’équivalent en TypeScript.

## Index

Un **index** aide PostgreSQL à trouver des lignes plus vite. Il doit correspondre aux recherches importantes, par exemple utilisateur + date. Il consomme aussi de l’espace et ralentit légèrement les écritures.

## JSON

**JSON** est un format texte pour objets, listes, chaînes, nombres, booléens et `null`. Le frontend et FastAPI l’utilisent pour la majorité de leurs échanges. JSON ne garantit pas que les champs ont le bon type : Pydantic et les parseurs TypeScript le vérifient.

## Migration

Une **migration** est un changement versionné du schéma de base. Les migrations du projet sont créées par Prisma. Elles permettent de faire évoluer une base existante de façon reproductible.

## Module

Un **module** regroupe du code et expose éventuellement des symboles. Dans ce projet, chaque fichier `.ts`, `.tsx` ou `.py` est généralement un module. Un module `domain` contient des concepts métier sans infrastructure.

## Next.js

**Next.js** est le framework web du frontend. Il fournit les pages App Router, le rendu serveur, le build de production et les route handlers utilisés comme proxies ou pour l’authentification.

## `null`, absent et `undefined`

`null` indique explicitement l’absence d’une valeur. En TypeScript, `undefined` peut indiquer qu’une propriété n’a pas été fournie. Dans un `PATCH`, « champ absent » signifie souvent « ne pas modifier », tandis que `null` peut signifier « effacer ». Cette distinction doit rester volontaire.

## Ownership

L’**ownership** est la propriété d’une ressource par un utilisateur. Une route sécurisée recherche une tâche par `id` et `userId`, pas par `id` seul. Cela évite qu’un utilisateur accède aux données d’un autre.

## Paramètre

Un **paramètre de fonction** est un nom reçu par une fonction, comme `date` dans `parse_date_key(date_key)`.

Un **paramètre de query** se trouve dans l’URL après `?`, comme `filter=last30` dans `/api/history?filter=last30`.

## Parser

Un **parser** lit une valeur non fiable et produit une valeur fiable ou une erreur. Les parsers sous `features/*/api` vérifient les JSON FastAPI à l’exécution. Un cast TypeScript n’est pas un parser.

## PostgreSQL

**PostgreSQL** est le système de base de données relationnelle utilisé. Le projet local le démarre en version 16 via Docker Compose.

## Prisma

**Prisma** est l’outil TypeScript propriétaire du schéma et des migrations dans ce projet. Son client est encore utilisé par Next.js pour l’utilisateur local. Il ne doit plus redevenir une seconde implémentation de la logique métier.

## Proxy

Un **proxy** reçoit une requête puis la transmet à un autre service. Les routes `app/api/*/route.ts` conservent la même origine pour le navigateur et relaient les requêtes à FastAPI.

## Pydantic

**Pydantic** valide et convertit les entrées de FastAPI. Il impose les types, bornes et enums avant que le routeur modifie la base.

## Python

**Python** est le langage du backend et du service Whisper. L’indentation délimite les blocs. Les annotations comme `str | None` rendent les contrats lisibles et sont exploitées par Pydantic/FastAPI.

## Query string

La **query string** est la partie d’une URL après `?`. Plusieurs paramètres sont séparés par `&`, par exemple `/api/calendar-events?from=2026-07-01&to=2026-08-01`.

## React

**React** construit l’interface à partir de composants et d’état. Un changement d’état provoque un nouveau rendu. React ne remplace ni l’API ni la base.

## Requête HTTP

Une **requête HTTP** est le message envoyé par un client. Elle contient une méthode, une URL, des en-têtes et parfois un corps. Le cookie de session voyage dans un en-tête.

## Réponse HTTP

Une **réponse HTTP** contient un statut, des en-têtes et éventuellement un corps. `Content-Disposition` indique par exemple qu’un rapport JSON doit être téléchargé.

## Retour

La **valeur de retour** est le résultat donné par une fonction. Une fonction Python FastAPI peut retourner un dictionnaire, que FastAPI convertit en JSON. Une fonction sans résultat utile retourne implicitement `None` en Python.

## Rollback

Un **rollback** annule une transaction de base après une erreur. Dans l’interface, le même mot désigne aussi la restauration de l’ancien état après l’échec d’une mise à jour optimiste.

## Route

Une **route** associe une méthode et un chemin à une fonction. Le décorateur `@router.get("")` combiné au préfixe `/api/tasks` crée `GET /api/tasks`.

## Schéma

Le **schéma de base** décrit tables, colonnes, types, relations, index et contraintes. `prisma/schema.prisma` en est la source de vérité.

Un **schéma JSON/Pydantic** décrit plutôt la forme d’une requête ou réponse. Le même mot est donc utilisé à deux niveaux différents.

## Secret

Un **secret** est une valeur privée qui protège un accès ou une signature. `APP_ACCESS_KEY` et `AUTH_SECRET` sont des secrets. `.env.example` ne doit contenir que des placeholders.

## Server Component

Un **Server Component** React est rendu par Next.js côté serveur. Il peut lire le cookie et appeler l’API interne, mais ne peut pas utiliser les hooks d’interaction navigateur.

## SQLAlchemy

**SQLAlchemy** mappe les tables PostgreSQL en classes Python et construit des requêtes. Dans ce projet, il exécute les accès métier de FastAPI mais ne crée pas les migrations.

## Table

Une **table** regroupe des lignes d’une même structure. Chaque ligne `Task` représente une tâche. Une clé primaire identifie la ligne et une clé étrangère la relie à une autre table.

## Test

Un **test** exécute un scénario et vérifie automatiquement un résultat. Une assertion échoue si le résultat réel diffère du résultat attendu. Les tests actuels utilisent principalement `unittest`.

## Transaction

Une **transaction** regroupe plusieurs opérations de base : elles réussissent toutes avec `commit` ou sont toutes annulées avec `rollback`. Elle protège la cohérence des commandes multi-enregistrements.

## TypeScript

**TypeScript** ajoute des types statiques à JavaScript. Le projet utilise le mode strict. Ces types améliorent le développement mais n’existent plus à l’exécution, d’où les parsers JSON.

## Upsert

Un **upsert** combine « mettre à jour si la ligne existe » et « insérer sinon ». Il s’appuie sur une clé unique et résiste mieux aux requêtes concurrentes qu’un `SELECT` suivi d’un `INSERT`.

## Variable

Une **variable** associe un nom à une valeur susceptible d’être lue ou modifiée. Un nom précis indique le sens de la donnée, par exemple `selectedDate` plutôt que `x`.

## Variable d’environnement

Une **variable d’environnement** configure un processus sans modifier le code. `DATABASE_URL` donne la connexion DB et `INTERNAL_API_URL` l’adresse FastAPI. Le fichier `.env` est une manière locale de définir ces variables.

## Whisper

**Whisper** est le modèle local de transcription audio. Il est exécuté dans un service séparé parce que son chargement et son calcul sont lourds par rapport à une route web classique.
