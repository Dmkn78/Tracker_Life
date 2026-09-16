# CI/CD vers une VM Windows avec IIS

> **Document historique, non actif.** La production confirmée utilise un VPS Ubuntu. Le workflow IIS a été retiré : il ciblait un export statique incompatible avec l’application actuelle et aucun runner IIS n’était configuré. Le circuit actuel est décrit dans [production-git.md](production-git.md). Les instructions et le script IIS ci-dessous restent des références pour une éventuelle migration future.

## État de compatibilité du dépôt

Le pipeline livré dans `.github/workflows/deploy.yml` est volontairement **fail-closed** : il ne déploie que si le projet produit un export statique Next.js dans `out/`.

L'application actuelle n'est pas encore dans cet état. Elle utilise notamment `cookies`, Prisma, `requireUser()` et des routes API Next côté serveur. Une vérification avec `output: 'export'` a échoué pendant la collecte de `/api/calendar-events`. Le premier push vers `main` s'arrêtera donc avec un message explicite tant que cette migration n'est pas réalisée.

Deux architectures sont possibles :

1. **Cible demandée (ce pipeline)** : migrer l'interface vers une application réellement exportable (`output: 'export'`), rendre les appels API accessibles depuis le navigateur et déployer `out/` sur IIS.
2. **Architecture compatible avec le code actuel** : conserver le rendu serveur Next, lancer Node comme service Windows et utiliser IIS comme reverse proxy. Cette variante ne respecte pas la contrainte « Node.js n'est pas utilisé comme serveur de production » ; elle n'est donc pas activée ici.

Next.js documente que l'export statique ne fournit pas de serveur d'exécution et ne prend pas en charge les fonctionnalités serveur telles que les routes dynamiques non exportables, les cookies ou les handlers API dynamiques. Voir [Static Exports](https://nextjs.org/docs/pages/guides/static-exports) et [Single-Page Applications](https://nextjs.org/docs/app/guides/single-page-applications).

## Architecture retenue

```text
push origin main
        |
        v
GitHub Actions (runner hébergé GitHub)
  checkout -> pnpm install --frozen-lockfile -> tests -> pnpm build
        |
        v
validation stricte de out/index.html + artifact versionné
        |
        v
GitHub Actions (runner self-hosted Windows sur la VM IIS)
  copie vers releases/<commit SHA>
  lecture de Get-Website().PhysicalPath
  bascule IIS Physical Path
  contrôle HTTP + deployment.json
        |
        +--> succès : nouvelle release active, ancienne conservée
        |
        +--> échec : restauration automatique de l'ancien Physical Path
```

Le runner installé directement sur la VM évite d'exposer WinRM/SSH depuis Internet et utilise le mécanisme officiellement supporté par GitHub pour les machines on-premises. Le runner établit une connexion sortante vers GitHub ; il faut donc autoriser HTTPS sortant, pas ouvrir un port entrant dédié. Voir [Self-hosted runners](https://docs.github.com/en/actions/concepts/runners/self-hosted-runners?platform=windows) et [Adding a self-hosted runner](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/add-runners?learn=hosting_your_own_runners).

## Fichiers livrés

- `.github/workflows/deploy.yml` : déclenchement uniquement sur `push` vers `main`, build/test, artifact, puis déploiement sur le runner Windows `iis-interface`.
- `scripts/deploy-iis.ps1` : validation, publication versionnée, bascule IIS, contrôle HTTP et rollback automatique.

Le script ne vide jamais le dossier actuellement servi. Il conserve chaque release sous `<IIS_DEPLOY_ROOT>\releases\<commit SHA>`, ajoute un `deployment.json` vérifiable par HTTP et garde l'ancienne Physical Path pour le rollback.

## Prérequis sur la VM

1. Installer IIS et le module PowerShell `WebAdministration`.
2. Créer le site IIS qui sert la racine de l'application. Le pipeline cible la Physical Path du **site**, pas une sous-application ou un virtual directory.
3. Installer Node.js 22 et pnpm 11 sur le runner si des outils locaux sont nécessaires. Le build est exécuté sur GitHub-hosted Ubuntu ; la VM ne sert qu'à publier l'artifact.
4. Installer un runner GitHub Actions x64 dans un dossier dédié, par exemple `C:\actions-runner`, avec les labels `self-hosted`, `windows`, `x64`, `iis-interface`. Le token d'enregistrement est temporaire et doit être copié depuis GitHub au moment de l'installation ; il ne doit jamais être commité.
5. Exécuter le runner comme service sous un compte dédié. Ce compte doit uniquement avoir :
   - lecture du workspace/artifact du runner ;
   - création et lecture de `<IIS_DEPLOY_ROOT>` ;
   - droit de modifier la configuration du site IIS ciblé ;
   - accès HTTP local à l'URL de health-check.

La modification de `Physical Path` est une opération d'administration IIS. Si la délégation IIS ne suffit pas, utiliser un compte de service dédié avec le minimum de privilèges approuvé par l'administrateur Windows, et ne pas réutiliser un compte personnel.

## Variables GitHub à configurer

Créer un environnement GitHub nommé `production`, puis ajouter ces **variables d'environnement** (pas des secrets) :

| Nom | Exemple | Usage |
| --- | --- | --- |
| `IIS_SITE_NAME` | `Interface` | Nom exact retourné par `Get-Website` |
| `IIS_DEPLOY_ROOT` | `C:\inetpub\interface` | Racine possédée par le déploiement |
| `IIS_HEALTH_URL` | `https://tracker.example.com/` | URL publique ou locale à contrôler |

Le pipeline n'a pas besoin de secret SSH : le job de déploiement s'exécute sur le runner installé sur la VM. Toute valeur secrète nécessaire à un futur build doit rester dans les secrets de l'environnement `production` et ne doit jamais être injectée dans du JavaScript statique envoyé au navigateur.

## Identifier la Physical Path IIS

Sur la VM, dans PowerShell administrateur :

```powershell
Import-Module WebAdministration
Get-Website | Select-Object Name, State, PhysicalPath, Bindings
(Get-Website -Name 'Interface').PhysicalPath
```

`Get-Website` expose la configuration du site, dont `PhysicalPath`. Voir [Microsoft Learn - Get-Website](https://learn.microsoft.com/en-us/powershell/module/webadministration/get-website?view=windowsserver2025-ps).

## Premier déploiement

1. Réaliser la migration de l'application vers un export statique, puis activer `output: 'export'` dans `next.config.ts`. Ne pas activer cette option avant d'avoir supprimé/remplacé les fonctionnalités serveur incompatibles.
2. Vérifier localement que `pnpm build` crée `out/index.html` et que le dossier contient tous les assets nécessaires.
3. Créer l'environnement `production`, ses trois variables et le runner `iis-interface`.
4. Vérifier la Physical Path et les permissions avec les commandes ci-dessus.
5. Pousser sur `main`. Le job `build-static-export` doit terminer avant que le job `deploy-iis` soit mis en file sur la VM.
6. Dans les logs Actions, vérifier le commit SHA, le nombre de fichiers, le chemin de release, le HTTP status et la validation de `deployment.json`.

## Rollback

Le rollback automatique se déclenche si la copie, la bascule, le health-check HTTP ou le marqueur de version échoue. Le script restaure alors l'ancienne Physical Path et laisse la nouvelle release sur disque pour diagnostic.

Rollback manuel vers le chemin précédent enregistré :

```powershell
Import-Module WebAdministration
$state = Get-Content 'C:\inetpub\interface\deployment-state.json' -Raw | ConvertFrom-Json
Set-ItemProperty 'IIS:\Sites\Interface' -Name physicalPath -Value $state.previousPath
Get-Website -Name 'Interface' | Select-Object Name, State, PhysicalPath
```

Rollback manuel vers une release connue :

```powershell
$release = 'C:\inetpub\interface\releases\<commit-sha>'
Set-ItemProperty 'IIS:\Sites\Interface' -Name physicalPath -Value $release
```

Ne supprimer aucune release active ou utile au rollback sans une procédure séparée de rétention et une sauvegarde vérifiée.

## Vérifier le build réellement servi

Depuis la VM ou un poste autorisé :

```powershell
$site = Get-Website -Name 'Interface'
$site | Select-Object Name, State, PhysicalPath

$root = 'https://tracker.example.com/'
$page = Invoke-WebRequest -Uri $root -UseBasicParsing
$marker = Invoke-WebRequest -Uri ([Uri]::new($root, 'deployment.json')) -UseBasicParsing

$page.StatusCode
$marker.StatusCode
$marker.Content | ConvertFrom-Json | Format-List
```

Le champ `releaseId` de `deployment.json` doit être égal au SHA affiché par le workflow GitHub Actions. Cela vérifie à la fois le chemin IIS actif et le contenu réellement délivré par IIS.

## Protections recommandées

- Protéger `main` et exiger le succès du job de build avant merge.
- Restreindre l'environnement `production` et le runner self-hosted aux workflows de confiance du dépôt ; ne jamais exécuter une pull request non fiable sur ce runner.
- Conserver `permissions: contents: read` dans le workflow.
- Garder `cancel-in-progress: false` pour éviter qu'un déploiement déjà basculé soit interrompu par un second push.
- Surveiller l'espace disque du dossier `releases` et prévoir une politique de rétention validée séparément. Le script ne supprime pas automatiquement de version.
