# Life Regime pour Android

L’application Android embarque ses écrans React avec Capacitor 8.5.2. Elle réutilise les composants To-do, Objectives et Performance, leur logique et le CSS du projet. Vite assemble ces composants sans embarquer le serveur Next.js. Le site web reste disponible via Next.js.

## Construire et installer

Prérequis : Node.js 22+, JDK 21 (fourni avec Android Studio compatible), Android Studio 2025.2.1 ou ultérieur, Android SDK Platform 36 et ses Build Tools. Android minimum : 7.0 / API 24. Les versions sont fixées dans `package.json` et `android/variables.gradle`.

À la racine du projet :

```powershell
npm install
npx prisma generate
npx prisma migrate deploy
npm run build
npx cap sync android
npx cap open android
```

`npm run build` compile le site web avec Webpack, puis les fichiers embarqués dans `mobile-dist`. Webpack évite le plantage Turbopack constaté sur ce poste Windows. Pour une modification uniquement mobile, `npm run build:mobile` suffit avant `npx cap sync android`.

Dans Android Studio : attendre la synchronisation Gradle, puis **Build → Generate App Bundles or APKs → Generate APKs** (ou **Build APK(s)** suivant la version). Le build debug produit un APK signé pour une installation personnelle :

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Alternative avec `ANDROID_HOME` et `JAVA_HOME` configurés :

```powershell
npm run android:apk
```

Copier l’APK sur le téléphone, l’ouvrir et autoriser ponctuellement cette source d’installation. Avec le débogage USB déjà autorisé, `adb install -r android/app/build/outputs/apk/debug/app-debug.apk` installe ou met à jour l’application. Conserver la même clé de signature pour les futures mises à jour. Une désinstallation efface les captures locales non synchronisées.

Le script vérifie la présence du SDK avant la compilation et ne prétend pas produire un APK lorsqu’il manque. La génération du bundle web et `cap sync` ne compilent pas le code Java : un build Gradle et un essai sur téléphone restent nécessaires pour valider la partie native.

## Connecter le téléphone aux données existantes

L’APK ne contient ni PostgreSQL, ni FastAPI, ni une copie de la clé d’accès. Les objectifs, tâches synchronisées, journaux et calculs de capital restent sur le serveur existant.

Pour une utilisation personnelle sur le même Wi-Fi, lancer l’API sur le PC :

```powershell
cd interface_API
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Autoriser si nécessaire le port 8000 sur le réseau **privé** dans le pare-feu Windows. Dans **Réglages → Connexion à mes données**, saisir `http://IP_LOCALE_DU_PC:8000`, puis la clé habituelle. `127.0.0.1` sur le téléphone ne désigne pas le PC. L’émulateur Android peut utiliser `http://10.0.2.2:8000`.

Le transport HTTP natif Capacitor conserve le cookie de session émis par l’API ; la clé saisie est effacée de l’état du formulaire après connexion. HTTP est accepté uniquement pour une IP privée ou localhost. Pour accéder aux données en dehors du Wi-Fi personnel, fournir un serveur HTTPS accessible au téléphone. Aucune ouverture de port publique n’est effectuée par ce projet. Si l’API impose des cookies `Secure`, utiliser HTTPS.

Les captures sont rattachées à l’adresse du serveur. Changer d’adresse ne transfère pas automatiquement les captures en attente à un autre serveur ; reconnecter l’ancienne adresse pour les synchroniser.

## Bouton + dans les notifications

1. Connecter une première fois l’application.
2. Ouvrir **Réglages → Activer le bouton +**.
3. Accepter l’autorisation de notifications Android si elle est demandée.
4. Dérouler les notifications, toucher **+**, saisir un titre et valider au clavier ou avec **Ajouter**.

La saisie s’ouvre dans une petite activité Android. Elle fonctionne sans réseau et conserve la capture dans SQLite. À la prochaine ouverture connectée de Life Regime, l’application envoie les captures au serveur et ne les efface localement qu’après accusé de réception. Un bouton **Synchroniser** permet de réessayer. Le statut « en attente » ne signifie pas que la tâche est déjà sur le serveur.

Chaque capture possède un UUID. Le serveur conserve un reçu d’importation, ce qui évite les doublons après une coupure et la réapparition d’une tâche supprimée après un nouvel essai. Les nouvelles tâches arrivent sans date dans l’entonnoir et ne génèrent aucune récompense avant exécution.

La notification est facultative, sans service permanent ni synchronisation réseau en arrière-plan. Android peut autoriser son masquage ou la bloquer dans les réglages du canal ; rouvrir l’application et réactiver le bouton si nécessaire. Elle est restaurée au démarrage du téléphone lorsque les autorisations le permettent. Les titres des tâches ne sont pas affichés sur l’écran verrouillé.

## Entonnoir, objectifs et interface mobile

- **Planning / Entonnoir** : bandeau vertical de toutes les tâches non terminées, y compris celles déjà datées. Création courte, objectif lié, accès au détail et retrait du planning.
- **Planification** : glisser une tâche dans le calendrier, ou toucher **Placer** puis un créneau. Le même identifiant de tâche est déplacé ; aucune copie n’est créée. La vue jour facilite l’usage au doigt, avec une vue semaine disponible.
- **Tâches** : liste et éditeur actuels, progression, statut, journal d’exécution et filtres.
- **Objectifs** : hiérarchie, milestones, planning et prévisions existants.
- **Capital** : métriques et règles existantes, fondées sur les données enregistrées.
- Navigation à cinq onglets, bouton + accessible en haut, teintes crème et zones adaptées au clavier et aux bords de l’écran.

Seule la capture rapide est disponible hors connexion. La consultation et l’édition des données existantes nécessitent le serveur. La connexion n’est pas un mode de synchronisation complet entre plusieurs bases de données.

## Organisation et contrôles

`mobile/` contient l’entrée embarquée, la connexion native, l’outbox et le CSS téléphone. `features/todo/components/TaskFunnel.tsx` est partagé avec le web. `native/android/` est la source des classes Java, de l’icône et du thème natif : le hook `capacitor:sync:after` les copie dans `android/app/src/main` et met à jour le manifeste de façon répétable. Modifier ces sources plutôt que leurs copies.

```powershell
npx tsc -p tsconfig.mobile.json --noEmit
npm run test:mobile
npm run test:todo
npm run build:mobile
npx cap sync android
```

Les tests PostgreSQL utilisent des transactions annulées : `RUN_DATABASE_TESTS=1` et `python -m unittest discover -s tests -q` dans `interface_API`. Tester sur téléphone : première connexion, permission refusée puis accordée, capture hors ligne, fermeture/redémarrage, reprise réseau, replanification au doigt et au drag, correction du temps réel. Vérifier qu’une coupure après réception côté serveur ne crée pas de doublon au prochain envoi.

Le test instrumenté `QuickCaptureStoreTest` vérifie la persistance SQLite après réouverture et l’accusé de réception limité au bon serveur. Avec un téléphone ou un émulateur connecté, le lancer depuis Android Studio, ou avec `android/gradlew.bat -p android :app:connectedDebugAndroidTest`. Ce test nécessite le SDK et un appareil ; il n’est pas exécuté par les tests JavaScript.

Références officielles : [prérequis Capacitor](https://capacitorjs.com/docs/getting-started/environment-setup), [HTTP natif](https://capacitorjs.com/docs/apis/http), [permission Android des notifications](https://developer.android.com/develop/ui/compose/notifications/notification-permission), [Android Studio et SDK](https://developer.android.com/studio).
