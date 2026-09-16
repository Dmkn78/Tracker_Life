# Performance / Rewards

## Utilisation

- **Performance** dans la navigation : indice, travail réel, cible, retard/avance, rythme requis, statut.
- **Log focused work** : titre, date passée ou du jour, minutes réellement travaillées, objectif facultatif. Une session apparaît également dans le planning Objectives (durée planifiée nulle).
- **Objectives → Log execution** sur un bloc : Done / Partial / Not done et minutes facultatives. Sans minutes, aucune durée planifiée n'est convertie en travail réalisé.
- **Correct** dans Performance : corriger les minutes ou remettre une session à Not done pour retirer sa contribution. Les blocs restent éditables dans Objectives.
- **Adjust** : cible de la semaine courante, entre 1 et 168 heures. Chaque nouvelle semaine part de 40 heures ; changer une cible ne change pas les semaines passées.
- **Rewards** : les 50 crédits les plus récents, leur motif et leur montant fictif.
- **History** : huit semaines et six mois calendaires, avec le mois/la semaine courant en cours.
- **Performance profile** : aperçu puis export texte des métriques. Aucune publication automatique ; pas de titre de tâche ni de note privée dans l'export.

L'accueil et Objectives contiennent une synthèse compacte. Les composants Card, Metric, ProgressBar, Drawer, les boutons, le shell et le planning existants sont réutilisés. La direction artistique d'origine est conservée : palette sombre par défaut, accents lavande, surfaces et contrastes existants. Les autres modes et les préférences enregistrées restent disponibles.

## Sources et règles

FastAPI est l'unique propriétaire du calcul. Le frontend valide la réponse et affiche les données.

| Source | Contribution |
| --- | --- |
| DailyLog SUBMITTED / ANALYZED, workTimeMinutes | Temps productif quotidien déclaré |
| WeeklyPlanBlock WORK / STUDY, Done / Partial, actualMinutes | Temps de focus enregistré |
| Task productive, DONE, completedAt | Livraison d'une tâche |
| Objective DONE, completedAt | Livraison d'objectif, projet ou jalon |
| PerformanceWeek | Cible indépendante par utilisateur et semaine ISO |

Le temps quotidien valorisé est `max(total du DailyLog, somme des minutes de focus)` : un total journalier inclut potentiellement ses sessions. Ce choix évite leur double comptage ; le journal doit contenir le **total** du travail de la journée. Les durées estimées et les blocs seulement planifiés ne rapportent rien. La saisie reste déclarative ; ce MVP n'est pas un dispositif de vérification externe du travail.

Les valeurs sont **fictives, sans valeur monétaire réelle** :

- Travail : 12 €/h, calculé en centimes entiers.
- Tâche productive : 1 €, ou 2 € si priorité haute.
- Jalon : 5 € ; objectif : 10 € ; projet : 25 €.
- Objectif livré à temps : prime de 2 €. L'échéance est figée au premier passage à DONE.
- Focus : prime de 1 € par jour dès 90 minutes enregistrées.
- Régularité : 5 € toutes les sept journées productives consécutives.
- Journée productive : au moins 60 minutes, ou trois tâches productives livrées, ou un objectif livré.

Le barème a été réduit à la demande de l'utilisateur. Tout l'historique est recalculé sur cette même base pour conserver des comparaisons homogènes. Les seuils de statut et les règles du streak restent inchangés. Les montants affichés dans l'aide de l'interface proviennent désormais du barème renvoyé par l'API.

L'indice hebdomadaire combine 50 % de trajectoire de travail, 30 % d'exécution des tâches prévues et 20 % de régularité. Sans tâches prévues, il utilise 60 % de trajectoire et 40 % de régularité. La trajectoire attendue répartit la cible sur les sept jours ; le rythme requis inclut aujourd'hui. Le score reste entre 0 et 100, mais le travail et le capital ne sont pas limités par la cible. La comparaison hebdomadaire porte sur le même nombre de jours écoulés.

| Statut | Capital cumulé fictif | Journées productives |
| --- | ---: | ---: |
| Foundation | 0 € | 0 |
| Established | 1 000 € | 7 |
| Proven | 5 000 € | 30 |
| Distinguished | 20 000 € | 90 |
| Principal | 60 000 € | 180 |

Les deux conditions doivent être remplies. Le statut, l'historique et les crédits sont recalculés après correction ou suppression des données sources ; ce n'est pas un compte financier immuable. Les journées passées sans activité cassent la série. Aujourd'hui peut être encore inachevé sans casser celle de la veille.

## Historique et intégrité

`completedAt` capture la première complétion. Réouvrir un élément retire sa contribution ; le terminer à nouveau restaure sa contribution à la même date, sans nouveau crédit. Les éléments déjà DONE avant la migration n'ont pas de date fiable : ils restent visibles dans les listes métier, et un compteur indique qu'ils sont exclus des métriques datées. Modifier simplement leur titre n'invente pas une date de complétion.

Les requêtes de création de session portent un UUID stable pour les retries. Réutiliser cet UUID avec une autre session retourne 409. Les écritures de temps se verrouillent par utilisateur pour limiter le total quotidien à 24 heures. Les sessions futures et les objectifs/blocs d'un autre utilisateur sont rejetés. Les dates suivent le fuseau du serveur, comme le reste de l'application ; configurer le serveur dans le fuseau attendu (Europe/Paris pour cette installation).

## Installation et vérification

La migration `20260913120000_performance` ajoute uniquement des colonnes et la table PerformanceWeek. Elle ne remplit pas de faux historique et ne supprime pas de données.

```powershell
node node_modules/prisma/build/index.js migrate deploy
node node_modules/prisma/build/index.js generate
node node_modules/typescript/bin/tsc --noEmit
node node_modules/next/dist/bin/next build
```

Tests du moteur : depuis `interface_API`, `.\.venv\Scripts\python.exe -m unittest tests.test_performance -v`.

Tests PostgreSQL facultatifs : `$env:RUN_DATABASE_TESTS='1'`, puis `.\.venv\Scripts\python.exe -m unittest tests.test_performance_api -v`. Ils créent des utilisateurs temporaires dans des transactions annulées en fin de test ; aucune donnée d'essai n'est conservée.

Le routeur de transcription était absent du dossier de travail avant cette modification. `main.py` permet désormais à l'API de démarrer sans lui et répond 503 après authentification sur la transcription indisponible. Remettre ce module réactive son routeur habituel.

## Limites intentionnelles

Pas de leaderboard, percentile, versement réel ni bonus monétaire réel. Le profil exportable est prêt pour une future couche sociale ; aucun faux groupe de comparaison n'est utilisé. Les valeurs de statut et de primes sont centralisées dans `interface_API/app/core/performance.py`. Les paramètres économiques sont fixes dans ce MVP ; une version ultérieure devra versionner ses règles pour préserver les comparaisons si ces paramètres évoluent.
