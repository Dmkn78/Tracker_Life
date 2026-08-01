# Fondamentaux du code

Ce chapitre donne le vocabulaire minimum pour lire le projet. Les exemples sont volontairement courts. Le glossaire complet se trouve dans [`11-GLOSSAIRE.md`](11-GLOSSAIRE.md).

## Un fichier et un module

Un **fichier** est un document enregistré sur le disque, par exemple `features/todo/domain/todoTask.ts`.

Un **module** est une unité de code qui expose des éléments à d’autres modules. Dans ce projet, un fichier TypeScript ou Python correspond généralement à un module.

## Variable et constante

Une variable associe un nom à une valeur. Une constante est un nom qui ne peut pas être réassigné.

```ts
const apiPath = "/api/tasks";
let selectedDate = "2026-07-31";
```

Explication ligne par ligne :

1. `const` crée la constante `apiPath` et lui donne une chaîne de caractères. On ne pourra pas remplacer cette valeur plus tard.
2. `let` crée `selectedDate`. Cette valeur peut changer lorsque l’utilisateur choisit une autre date.

Erreur fréquente : `const` n’empêche pas de modifier le contenu d’un objet ; il empêche seulement de réassigner le nom à un autre objet.

## Fonction, paramètre et valeur de retour

Une fonction regroupe une opération réutilisable. Un paramètre est une donnée reçue. La valeur de retour est le résultat rendu à l’appelant.

```ts
function buildTaskPath(date: string): string {
  return `/api/tasks?date=${encodeURIComponent(date)}`;
}
```

Explication ligne par ligne :

1. `function` déclare `buildTaskPath`. Le paramètre `date` doit être une chaîne, et le résultat annoncé après `:` est aussi une chaîne.
2. `return` construit puis renvoie l’URL. `encodeURIComponent` empêche les caractères spéciaux de casser la requête.
3. `}` termine le corps de la fonction.

Erreur fréquente : oublier d’encoder une valeur insérée dans une URL peut modifier involontairement les paramètres de la requête.

## Import et export

`export` rend un symbole utilisable ailleurs. `import` le récupère.

```ts
import { requestJson } from "@/lib/http/apiClient";

export const TASKS_API_PATH = "/api/tasks";
```

Explication ligne par ligne :

1. La première ligne importe la fonction partagée `requestJson`. L’alias `@/` pointe vers la racine du projet grâce à `tsconfig.json`.
2. La ligne vide sépare deux idées.
3. La constante est exportée pour être utilisée par le module API de la feature Todo.

Erreur fréquente : importer un composant React depuis un module `domain/` inverserait le sens des dépendances. Le domaine doit rester indépendant de l’interface.

## Type TypeScript

Un type décrit la forme attendue d’une valeur sans créer de donnée à l’exécution.

```ts
type TaskSummary = {
  id: string;
  done: boolean;
};
```

Explication ligne par ligne :

1. `type TaskSummary` commence la description d’un objet.
2. `id` doit être une chaîne.
3. `done` doit être un booléen, donc `true` ou `false`.
4. `};` ferme la définition.

Erreur fréquente : un type TypeScript disparaît après compilation. Il ne valide donc pas un JSON reçu du réseau ; c’est pourquoi les modules `features/*/api` analysent d’abord une valeur `unknown`.

## Classe Python et modèle Pydantic

```python
class TaskInput(BaseModel):
    title: str
    estimated_minutes: int = 0
```

Explication ligne par ligne :

1. `class TaskInput(BaseModel):` crée un modèle Pydantic qui sait valider des données entrantes.
2. `title: str` rend le titre obligatoire et exige une chaîne.
3. `estimated_minutes: int = 0` exige un entier mais fournit `0` si le champ est absent.

Erreur fréquente : cette classe ne crée pas une table PostgreSQL. Les modèles Pydantic valident l’HTTP ; les modèles SQLAlchemy de `models.py` représentent la base.

## Frontend et backend

Le **frontend** est la partie visible et interactive exécutée ou rendue pour le navigateur. Ici : Next.js, React, TypeScript, Tailwind, `app/`, `features/` et `components/`.

Le **backend** reçoit les requêtes, applique les règles métier et accède aux données. Ici : FastAPI, Pydantic, SQLAlchemy et `interface_API/app/`.

Next.js possède aussi une petite partie serveur : les Server Components, les routes d’authentification et les proxies. Cela ne transforme pas Next.js en seconde source de logique métier.

## API, route et endpoint

Une **API** est un contrat permettant à des programmes de communiquer.

Une **route** associe une méthode HTTP et un chemin à du code. `GET /api/tasks` et `POST /api/tasks` sont deux routes différentes parce que leur méthode diffère.

Un **endpoint** désigne couramment ce point de communication complet. Dans cette documentation, « route » et « endpoint » sont parfois employés comme synonymes.

## Requête HTTP, réponse HTTP et JSON

Une requête HTTP contient principalement :

- une méthode, comme `GET`, `POST`, `PATCH` ou `DELETE` ;
- un chemin, comme `/api/tasks` ;
- des en-têtes, par exemple le type du contenu ou le cookie ;
- parfois un corps JSON.

Une réponse contient un code de statut, des en-têtes et souvent un corps JSON.

```json
{
  "title": "Lire la documentation",
  "productive": true
}
```

Explication ligne par ligne :

1. `{` ouvre un objet JSON.
2. La propriété `title` contient une chaîne ; les noms de propriétés et les chaînes utilisent des guillemets doubles.
3. `productive` contient le booléen JSON `true`, sans guillemets.
4. `}` ferme l’objet.

Erreur fréquente : JSON n’accepte ni commentaires, ni virgule après la dernière propriété, ni guillemets simples.

## Base de données, table et migration

La base de données PostgreSQL conserve les informations entre deux lancements. Une **table** regroupe des lignes de même nature : `Task` contient des tâches, `DailyLog` des journaux quotidiens.

Une **migration** est une modification versionnée du schéma : ajout de colonne, nouvel index, nouvelle table. Dans ce projet, Prisma est le seul outil autorisé à créer ces migrations.

## Erreur et test

Une erreur est un comportement inattendu ou un refus prévu. Une réponse `422` est par exemple un refus prévu lorsque Pydantic rejette une donnée invalide. Une réponse `500` indique une erreur interne non prévue.

Un test exécute automatiquement un scénario et vérifie un résultat. Les tests actuels se trouvent sous `interface_API/tests/`. Ils ne remplacent pas la vérification manuelle de l’interface, car aucun test frontend ou end-to-end n’est présent.

## À retenir avant de continuer

- Un type annonce une forme ; un parseur réseau vérifie la donnée réelle.
- Un composant affiche et orchestre ; il ne doit pas contenir la logique HTTP brute.
- Un contrat Pydantic valide l’entrée ; un modèle SQLAlchemy représente la persistance.
- Une route combine toujours au moins une méthode et un chemin.
- Une migration Prisma modifie la structure des données et exige un alignement côté Python.

Continuez avec [`ARCHITECTURE.md`](ARCHITECTURE.md) pour relier toutes ces notions.
