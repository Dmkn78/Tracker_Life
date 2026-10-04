# Life Regime Android — interface mobile (1.0.8)

La version 1.0.8 ajoute la publication automatique des APK depuis GitHub et leur installation depuis **Mon téléphone → Version et mises à jour**. Le serveur garde le jeton du dépôt privé ; le téléphone reçoit seulement les métadonnées et le fichier APK. Android vérifie toujours la signature et demande de confirmer l’installation.

## Fonctionnement

La version 1.0.7 rétablit l’interface téléphone : **Tâches, Planning, Logs, Objectifs, Plus**, bouton + et page **Mon téléphone** avec apparence, suivi, notifications, connexion et mises à jour. Elle utilise les composants métier du site et les données de ses API. Elle ne redirige plus vers les pages de bureau comme la version 1.0.6.

L’APK embarque une interface mobile fonctionnelle, dont la dictée actuelle à **trente minutes / 100 Mo**. Un site qui n’a pas encore publié la nouvelle interface mobile reste utilisable comme serveur de données : la notification et les paramètres n’attendent pas l’installation d’un composant dans la page web.

## Installer et connecter

Installer l’APK **1.0.8 par-dessus** l’ancienne version, avec la même signature. Le serveur déjà enregistré et les captures SQLite restent conservés. Les préférences de l’ancienne interface mobile sont récupérées lorsque présentes. Une reconnexion peut être nécessaire si la session a expiré.

Dans **Réglages → Connexion à mes données**, utiliser l’adresse du site ou de l’API et la clé habituelle. Les tâches, logs et objectifs restent sur le serveur. L’application vérifie la session avant de se déclarer connectée. Les thèmes et le formulaire de connexion restent accessibles si le serveur est indisponible.

## Notification des tâches

**Réglages → Notification des tâches** affiche :

- l’état d’activation et les autorisations Android ;
- le nombre réellement reçu du serveur, par exemple `4 / 12 terminées` ;
- la date et l’heure du dernier relevé ;
- un aperçu de trois tâches restantes ;
- **Activer le bouton +**, **Actualiser le compteur** et, si nécessaire, **Autorisations Android**.

Le compteur utilise `/api/tasks?scope=today&date=...`, avec la date locale du téléphone. Il exclut les tâches annulées. Il se met à jour après une modification, au retour au premier plan, au retour du réseau et toutes les trente secondes pendant que l’application est visible. Une ancienne capture en attente ne bloque pas cette lecture. Une panne ne remplace jamais les données par un faux zéro : l’erreur est visible dans les paramètres et la notification conserve le dernier relevé daté.

La notification compacte affiche le compteur, la progression et le +. Dépliée, elle affiche aussi les trois premières tâches restantes. Le + ouvre directement **l’éditeur Todo de l’application**, daté d’aujourd’hui, avec une date modifiable. Toucher l’aperçu ouvre la liste. Il s’agit d’une notification, pas d’un widget placé sur l’écran d’accueil.

L’application ne fait pas de requêtes permanentes lorsqu’elle est fermée : les changements effectués sur le site sont repris à la prochaine ouverture. Les intitulés ne sont pas affichés sur l’écran verrouillé (`VISIBILITY_SECRET`).

## Mettre l’interface mobile à jour depuis le site

`npm run build:web` compile **deux présentations avec les mêmes composants** : le site Next.js et l’interface mobile Vite dans `public/mobile-app/`. Ce dossier généré doit être présent sur le serveur qui expose le site. Une API FastAPI seule ne sert pas ces fichiers.

La publication comprend :

- `/mobile-app/index.html` et ses fichiers `assets/` ;
- `/mobile-app/release.json` : identifiant de build, date, entrée fixe, version Android minimale.

L’application vérifie la publication à l’ouverture, au retour au premier plan et chaque minute tant qu’elle est visible. **Réglages → Interface mobile → Mettre à jour l’interface** ouvre la présentation mobile publiée, après confirmation pour terminer la saisie/dictée en cours. Elle garde les cinq onglets et les paramètres téléphone. Le thème et la langue sont transférés lors du changement d’interface.

Une fois ce mode activé, une nouvelle ouverture à froid charge l’interface mobile publiée depuis le réseau ; une application déjà ouverte propose le nouveau build sans effacer son formulaire. Si cette interface est inaccessible ou ne démarre pas sous vingt-cinq secondes, l’APK revient à son interface intégrée, avec une explication et sans boucle de rechargement. **Utiliser la version intégrée** permet aussi de revenir manuellement. Une interface nécessitant des fonctions natives plus récentes demande d’abord une mise à jour d’APK.

Les tâches restent sur le serveur dans les deux modes. Une connexion réseau est nécessaire pour les consulter/enregistrer ; les brouillons de logs sont locaux et séparés par origine. Terminer/enregistrer les brouillons avant de changer de mode, comme indiqué par la confirmation. Les captures SQLite avec accusé de réception restent partagées et limitées au serveur d’origine.

Un `git push` ne déploie pas le serveur à lui seul. Sur le VPS : récupérer le code, exécuter `npm run build:web` puis redémarrer le service habituel. Le build génère `public/mobile-app` automatiquement ; en cas de livraison par copie, copier également ce dossier. L’index et le manifeste sont servis sans cache. Conserver les anciens fichiers `assets` pendant les déploiements évite de casser les pages déjà ouvertes. Préférer un déploiement atomique du dossier de publication. Sans publication mobile, l’interface intégrée reste utilisable et les réglages le précisent.

## Compiler l’APK

Prérequis : Node.js 22+, JDK 21, Android Studio, SDK Platform 36 et Build Tools. Android minimum : API 24.

```powershell
npm install
npm run build:mobile
npx cap sync android
npx cap open android
```

Ou avec le SDK/JDK configuré :

```powershell
npm run android:apk
```

Le workflow `npm run build → npx cap sync android → Android Studio` reste valide. L’APK se trouve dans `android/app/build/outputs/apk/debug/app-debug.apk`.

Conserver la clé de signature pour pouvoir installer par-dessus l’existant. Dans cet environnement, `.runtime/build-apk-local.ps1` sélectionne le SDK, le JDK et la clé `.runtime/android-user/debug.keystore` déjà utilisée. Les changements de pages/CSS/logique peuvent ensuite venir de la publication mobile ; les nouvelles permissions ou fonctions Java exigent encore un APK.

## Publication des APK natifs

Les pushes sur `main` et `dev_branch` lancent `.github/workflows/ci.yml`. Après les tests web/mobile/API/PostgreSQL et Android, le job `Publish signed Android update` compile un APK release avec la clé persistante, vérifie sa signature, puis publie une GitHub Release complète : `release.json` et `<sha256>.apk`. Le code Android croît automatiquement à chaque publication, même si le nom de version reste identique.

Configurer ces secrets privés du dépôt : `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. Ils doivent correspondre à la clé de l’application déjà installée. Une clé neuve ne permet pas une mise à jour par-dessus. Les builds personnels précédents utilisent `.runtime/android-user/debug.keystore` ; le fichier doit rester hors de Git. Son transfert vers les secrets GitHub nécessite l’autorisation du propriétaire.

Sur le VPS, dans l’environnement privé de l’API :

```dotenv
MOBILE_GITHUB_REPOSITORY=Dmkn78/Tracker_Life
MOBILE_GITHUB_TOKEN=<jeton privé limité à Contents: read sur ce dépôt>
```

Déployer le code serveur puis redémarrer le service API. `/api/mobile-update` lit la dernière release Android publiée et `/api/mobile-update/apk/<sha256>` télécharge et vérifie l’APK, puis le conserve dans le cache local. Une erreur GitHub n’est jamais présentée comme « à jour ». Le jeton n’est jamais envoyé au téléphone. La publication d’une release ne déploie pas le VPS : les contrôles Actions et le déploiement serveur restent deux opérations distinctes.

Pour publier localement, `npm run android:release` empaquette un **APK release signé déjà compilé**. Le build release exige `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. Pour les builds debug historiques : `npm run android:release -- .runtime/mobile-release debug`. Sans `MOBILE_GITHUB_REPOSITORY`, l’API conserve la publication locale depuis `MOBILE_RELEASE_DIR` ou `.runtime/mobile-release` : copier l’APK puis `release.json` en dernier.

Le panneau Android contrôle taille, hash, identifiant, version croissante et signature avant installation. Une ancienne APK sans plugin de mise à jour nécessite une première installation manuelle de la nouvelle APK avec la même signature. Une interface mobile publiée récente propose aussi un lien de téléchargement navigateur dans ce cas. Ne pas désinstaller l’application pour conserver ses données locales.

## Sources et vérification

- `mobile/MobileApp.tsx` : présentation mobile, connexion et navigation.
- `mobile/NotificationSettings.tsx`, `useNotificationSummary.ts` : notification et état de synchronisation.
- `mobile/InterfaceUpdateControl.tsx` : publication et changement d’interface.
- `scripts/build-website.mjs`, `mobile/vite.config.ts` : publication mobile avec le site.
- `native/android/` : sources Java/ressources copiées par le hook de `cap sync` vers `android/app/src/main`.

```powershell
npm run test:mobile
npx tsc -p tsconfig.mobile.json --noEmit
npm run build:web
npm run build:mobile
npx cap sync android
android/gradlew.bat -p android :app:testDebugUnitTest :app:assembleDebug
```

Tester sur téléphone : compteur face aux tâches du site, marquer une tâche terminée, ouvrir le + application fermée et ouverte, changer sa date, refuser/autoriser les notifications, thème, reconnexion, dictée, publication mobile, panne du serveur et retour à l’interface intégrée. Les tests locaux couvrent notamment un jeu de douze tâches, la progression, les erreurs réseau, les thèmes et le changement d’interface ; ils ne remplacent pas un essai sur l’appareil.
