# Frontend : Next.js, React et TypeScript

## Technologies utilisées

| Technologie | Ce que c’est | Pourquoi ici | Où la trouver |
| --- | --- | --- | --- |
| Next.js 16.2.9 | Framework web basé sur React | Routage, rendu serveur, build et routes proxy | `app/`, `next.config.ts` |
| React 19.2.7 | Bibliothèque de composants d’interface | Écrans, formulaires et état interactif | `features/*/components`, `components/` |
| TypeScript 6.0.3 strict | JavaScript avec vérification statique | Détecter les incompatibilités avant l’exécution | fichiers `.ts` et `.tsx`, `tsconfig.json` |
| Tailwind CSS 3.4.19 | Classes utilitaires CSS | Construire rapidement le style cohérent | `app/globals.css`, `tailwind.config.ts`, classes JSX |
| FullCalendar 6.1.21 | Composant de calendrier | Affichage et interaction avec les événements | feature `calendar` et terminal de vie |
| Recharts 3.8.1 | Bibliothèque de graphiques React | Courbes de trajectoire et visualisations | composants de graphiques |
| Lucide React 1.20.0 | Bibliothèque d’icônes | Icônes homogènes | imports `lucide-react` |

Un débutant doit d’abord comprendre qu’un fichier `.tsx` peut contenir du JSX, c’est-à-dire une description d’interface proche du HTML. Un fichier `.ts` contient normalement de la logique sans JSX.

## Pages réelles

| URL | Fichier principal | Rôle |
| --- | --- | --- |
| `/login` | `app/login/page.tsx` | Connexion par clé d’accès |
| `/` | `app/page.tsx` | Accueil et résumé de situation |
| `/life` | `app/life/page.tsx` | Trajectoire et résumé hebdomadaire |
| `/life-terminal` | `app/life-terminal/page.tsx` | Tableau de bord détaillé et interactif |
| `/daily-log` | `app/daily-log/page.tsx` | Saisie du journal quotidien |
| `/todo` | `app/todo/page.tsx` | Gestion des tâches |
| `/calendar` | `app/calendar/page.tsx` | Événements et contraintes du calendrier |
| `/habits` | `app/habits/page.tsx` | Habitudes et validations journalières |
| `/objectives` | `app/objectives/page.tsx` | Arbre d’objectifs et planning hebdomadaire |
| `/time-allocation` | `app/time-allocation/page.tsx` | Budget de temps et catégories |
| `/history` | `app/history/page.tsx` | Historique filtré et export hebdomadaire |
| `/settings` | `app/settings/page.tsx` | Préférences utilisateur et déconnexion |
| `/dashboard` | `app/dashboard/page.tsx` | Alias de `/life` |
| `/dashboard/life-terminal` | `app/dashboard/life-terminal/page.tsx` | Alias de `/life-terminal` |

Toutes les pages métier appellent `requireUser()`. La page de connexion est la seule page publique de l’interface.

## Server Component ou Client Component ?

Dans App Router, un composant est rendu côté serveur par défaut.

Un **Server Component** :

- peut lire le cookie avec les API serveur Next.js ;
- peut appeler FastAPI par `requestInternalApiJson` ;
- ne peut pas utiliser `useState`, `useEffect` ou les événements du navigateur ;
- est adapté au chargement initial d’une page.

Un **Client Component** commence par la directive `"use client"` :

- il s’exécute dans le navigateur ;
- il peut gérer formulaires, clics et état React ;
- il reçoit généralement les données initiales de la page serveur ;
- ses écritures passent par le module `api/` de sa feature.

Le flux typique est donc : page serveur authentifiée → données initiales validées → composant client interactif.

## Organisation par feature

La convention est `features/<feature>/{components,api,domain}`.

### `domain/`

Contient :

- types TypeScript stables ;
- enums ou unions de chaînes ;
- valeurs par défaut ;
- calculs purs et transformations sans entrée/sortie réseau.

Ne doit pas importer React, `fetch`, Prisma, un route handler ou une bibliothèque de base de données.

### `api/`

Contient :

- fonctions comme charger, créer, mettre à jour ou supprimer ;
- construction des query strings et corps JSON ;
- parseurs de réponses ;
- adaptation entre le JSON et les types du domaine.

Toute réponse réseau entre comme `unknown`. Le parseur vérifie réellement l’objet, les tableaux et les champs avant de le rendre au composant.

### `components/`

Contient :

- affichage React ;
- état local et événements utilisateur ;
- orchestration des fonctions du module `api/` ;
- gestion de chargement, succès, erreurs et rollback.

Un composant ne doit pas appeler `fetch` directement. Cette règle permet de retrouver tous les appels d’une feature dans un seul dossier.

## Inventaire des features

| Feature | API/domain importants | Composants importants |
| --- | --- | --- |
| `auth` | `sessionApi.ts` | formulaire dans `app/login/page.tsx` |
| `calendar` | `calendarEventsApi.ts`, `calendarEvent.ts` | `CalendarClient.tsx` |
| `daily-log` | `dailyLogApi.ts`, `dailyLog.ts` | `DailyLogForm.tsx`, `DailyLogDatePicker.tsx` |
| `habits` | `habitsApi.ts`, `habit.ts` | `HabitsClient.tsx` |
| `history` | `historyApi.ts`, `history.ts` | rendu principalement serveur |
| `life-terminal` | `lifeTerminalApi.ts`, `lifeTerminal.ts` | `LifeTerminalClient.tsx`, `TerminalPanel.tsx`, `CalendarCommandCenter.tsx` |
| `objectives` | `objectivesApi.ts`, plusieurs modules de domaine | éditeur, arbre, carte, planning et sidebar séparés |
| `settings` | `settingsApi.ts`, `settings.ts` | `SettingsClient.tsx`, `LogoutButton.tsx` |
| `time-allocation` | `timeAllocationApi.ts`, `timeAllocation.ts` | `TimeAllocationClient.tsx` |
| `todo` | `todoApi.ts`, `todoTask.ts` | `TodoClient.tsx`, `TodoList.tsx` |

## Appels HTTP du navigateur

`lib/http/apiClient.ts` centralise :

- `credentials: "include"` pour envoyer le cookie ;
- l’en-tête `Accept: application/json` ;
- un timeout par défaut de 15 secondes ;
- la composition avec un `AbortSignal` fourni par le composant ;
- l’analyse du JSON, y compris les réponses invalides ;
- `ApiError` avec statut et détails.

Quand plusieurs chargements peuvent se chevaucher, le composant doit annuler l’ancien. Sinon, une réponse lente pour la date A peut écraser une réponse plus récente pour la date B.

## Mises à jour optimistes

Une mise à jour optimiste modifie l’écran avant la réponse serveur. Elle donne une interface rapide mais impose trois règles :

1. conserver l’ancienne valeur ;
2. envoyer la requête par le module API ;
3. restaurer l’ancienne valeur et afficher l’erreur si la requête échoue.

Pour une écriture susceptible d’être envoyée plusieurs fois, préférer une opération idempotente ou un upsert backend. Ne pas déclencher plusieurs autosaves concurrents sans coordination.

## Ajouter une nouvelle capacité frontend

Exemple : une feature `notes`.

1. Créer `features/notes/domain/note.ts` avec les types et règles pures.
2. Créer `features/notes/api/notesApi.ts` avec appels et parseurs.
3. Créer `features/notes/components/NotesClient.tsx` pour l’interface.
4. Créer `app/notes/page.tsx` pour l’authentification et le chargement initial.
5. Créer `app/api/notes/route.ts` seulement si le navigateur doit appeler cette route.
6. Ajouter la route FastAPI, le contrat Pydantic et les tests correspondants.
7. Ajouter la navigation et vérifier que Tailwind scanne toujours `features/**/*`.
8. Exécuter `pnpm check`.

Ne créez pas un fichier partagé sous `lib/` tant que son usage n’est pas réellement transversal. Une règle propre à Notes appartient à la feature Notes.

## Modifier un composant sans le rendre illisible

Extrayez un sous-composant lorsqu’un bloc :

- possède un nom métier évident ;
- reçoit des entrées claires ;
- gère une responsabilité indépendante ;
- peut être relu sans connaître tout le parent.

N’extrayez pas chaque balise dans un fichier. Le but est de rendre les responsabilités visibles, pas d’augmenter artificiellement le nombre de fichiers.

## Fichiers transversaux à ne pas casser

- `app/layout.tsx` : structure globale et feuille de styles.
- `components/AppShell.tsx` : navigation partagée.
- `components/ui.tsx` : primitives visuelles communes.
- `lib/http/apiClient.ts` : contrat d’erreur et validation réseau partagée.
- `lib/server/internalApiClient.ts` : transfert de cookie des pages serveur.
- `lib/server/proxyApiRequest.ts` : transfert exact des requêtes navigateur.
- `tailwind.config.ts` : doit inclure `app`, `components`, `features` et `lib` dans `content`.
- `tsconfig.json` : mode `strict` et alias `@/*`.

## Erreurs fréquentes

- Ajouter `"use client"` à une page entière alors qu’un petit composant interactif suffit.
- Utiliser un cast `as MyType` sur un JSON non validé.
- Appeler FastAPI depuis le navigateur avec son URL interne.
- Dupliquer une constante ou un type dans le composant et le module API.
- Mettre des calculs métier dans `route.ts`.
- Oublier `encodeURIComponent` pour un paramètre dynamique.
- Oublier de gérer l’annulation d’un chargement qui dépend d’une date ou d’un filtre.
- Modifier une réponse FastAPI sans adapter son parseur TypeScript.

La procédure complète de modification se trouve dans [`08-MAINTENANCE-ET-REGLES.md`](08-MAINTENANCE-ET-REGLES.md).
