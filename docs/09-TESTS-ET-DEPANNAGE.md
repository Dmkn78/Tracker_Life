# Tests, vérification et dépannage

## Commande de référence

```powershell
pnpm check
```

Cette commande exécute dans cet ordre :

1. `pnpm typecheck` — vérification TypeScript stricte, sans fichier généré ;
2. `pnpm test:api` — tests Python `unittest` ;
3. `pnpm build` — compilation Next.js de production.

Si une étape échoue, les suivantes ne démarrent pas. Corrigez la première erreur réelle, puis relancez la commande complète.

## Tests Python présents

| Fichier | Couverture actuelle |
| --- | --- |
| `test_contracts.py` | alias camelCase, enums, bornes, dates/heures, patchs partiels et contraintes Pydantic |
| `test_security.py` | aller-retour du cookie et rejet robuste de jetons malformés |
| `test_numeric_parity.py` | égalité d’arrondi/calcul avec l’ancienne sémantique JavaScript |
| `test_api_boundaries.py` | contenu public de health et authentification obligatoire de transcription |

Le lanceur `scripts/test-api.ps1` choisit `interface_API/.venv/Scripts/python.exe` s’il existe, sinon `python`, puis exécute la découverte `unittest` depuis `interface_API`.

## Exemple de test et lecture ligne par ligne

```python
def test_javascript_round_uses_positive_infinity_for_ties(self) -> None:
    self.assertEqual(javascript_round(52.5), 53)
    self.assertEqual(javascript_round(-1.5), -1)
```

Explication ligne par ligne :

1. Le nom de la fonction commence par `test_`, ce qui permet à `unittest` de l’exécuter. `-> None` annonce qu’elle ne retourne pas de résultat métier.
2. La première assertion vérifie que `52.5` devient `53`.
3. La seconde vérifie le cas subtil négatif : JavaScript arrondit `-1.5` vers `-1`, contrairement à l’arrondi bancaire natif de Python.

Erreur fréquente : remplacer `javascript_round` par `round` peut laisser de nombreux tests simples au vert tout en changeant les valeurs exactement à `.5`.

## Ce qui n’est pas testé automatiquement

Il n’existe actuellement aucun :

- test unitaire React ;
- test de composant dans un navigateur simulé ;
- test end-to-end du navigateur à PostgreSQL ;
- test d’intégration sur un vrai PostgreSQL pour transactions et ownership ;
- test automatisé du service ou du modèle Whisper ;
- pipeline CI/CD visible dans le dépôt.

Ces absences sont les principaux risques de régression. Les tests de contrats ne prouvent pas qu’une migration SQL, une interaction React ou un service externe fonctionne réellement.

## Tests à ajouter en priorité

1. Intégration PostgreSQL isolée pour chaque route d’écriture importante.
2. Tests d’ownership : un utilisateur ne peut jamais lire/lier/modifier la ressource d’un autre.
3. Rollback d’une commande multi-enregistrements en cas d’échec intermédiaire.
4. Parcours end-to-end : login → création d’une tâche → lecture → modification.
5. Composants complexes `ObjectivesClient`, `LifeTerminalClient` et formulaires autosave.
6. Contrat proxy multipart pour `/api/transcribe` sans exécuter un vrai modèle.
7. Parité des read models History/Life Terminal avec des fixtures déterministes.

## Diagnostiquer par couche

### 1. PostgreSQL

Vérifiez `docker compose ps`, le port `5432`, puis `DATABASE_URL`. Une erreur de connexion au démarrage FastAPI indique souvent une base absente, un mot de passe incorrect ou une migration non appliquée.

### 2. FastAPI

Appelez `GET http://127.0.0.1:8000/api/health`. Consultez le terminal du processus Python. Une réponse health ne prouve pas qu’une requête SQL aboutira, car elle ne lit pas forcément une table.

### 3. Next.js

Une réponse `503` contenant `API service is unavailable` vient généralement de `proxyApiRequest` ou du client SSR : vérifiez `INTERNAL_API_URL` et FastAPI.

### 4. Session

Un `401 Unauthorized` signifie que le cookie est absent, expiré, malformé ou signé avec un autre secret. Effacez le cookie, vérifiez les secrets partagés et reconnectez-vous.

### 5. Contrat JSON

Le message `The API returned an invalid response` vient d’un parseur TypeScript. Comparez le JSON réel de FastAPI au parseur `features/<feature>/api`. Ne corrigez pas le problème avec un cast `as`.

### 6. Whisper

Vérifiez `/health` sur le port `8001`, les dépendances, le modèle configuré, l’espace disque temporaire et FFmpeg. Les codes `413`, `415`, `502` et `503` ont des causes distinctes décrites dans [`whisper.md`](whisper.md).

## Codes d’erreur fréquents

| Symptôme | Cause probable | Action sûre |
| --- | --- | --- |
| `401` | cookie invalide ou absent | reconnecter, comparer `AUTH_SECRET` |
| `404` sur un id connu | mauvais utilisateur ou ressource archivée/inexistante | vérifier filtre `userId`, ne pas retirer le contrôle |
| `422` | Pydantic refuse le corps/query | lire `details`, corriger le contrat ou l’appelant |
| `500` | exception backend imprévue | lire le log serveur, ne pas exposer l’exception au client |
| `503 API service is unavailable` | FastAPI arrêté ou URL erronée | tester `/api/health`, vérifier `INTERNAL_API_URL` |
| `413` audio | fichier supérieur à `MAX_AUDIO_BYTES` | réduire le fichier ou ajuster la limite sur les deux services |
| `415` audio | MIME non accepté | utiliser un type `audio/*`, `video/webm` ou octet-stream prévu |
| `502` audio | Whisper a échoué/répondu invalide | consulter le service Whisper |
| `P2002` ou violation unique | concurrence ou doublon non géré | utiliser l’upsert prévu et conserver la contrainte |
| styles absents après build | chemin non scanné par Tailwind | vérifier `content` dans `tailwind.config.ts` |

## Dates et fuseaux horaires

Trois formats apparaissent :

- date civile : `YYYY-MM-DD` ;
- semaine ISO : `YYYY-Www` ;
- date-heure : chaîne ISO, parfois avec fuseau.

Erreurs typiques : transformer une date civile en UTC puis changer accidentellement de jour, comparer une date naïve à une date avec fuseau, ou calculer la semaine ISO avec une règle locale. Utilisez `lib/dates.ts` et `interface_API/app/core/dates.py`.

## Vérification ciblée pendant le développement

- TypeScript seulement : `pnpm typecheck`.
- Tests API seulement : `pnpm test:api`.
- Build seulement : `pnpm build`.
- Tous les tests Python depuis `interface_API` : `python -m unittest discover -s tests -v`.
- Diff de whitespace Git : `git diff --check`.

La vérification ciblée accélère la boucle, mais la commande finale reste `pnpm check`.

## Avant de signaler un bug

Notez :

- URL de la page et action exacte ;
- méthode/chemin HTTP en erreur ;
- code de statut et JSON d’erreur sans cookie ni secret ;
- date/filtre/identifiant non sensible impliqué ;
- logs Next, FastAPI ou Whisper pertinents ;
- résultat de `pnpm check` ;
- caractère reproductible sur une base de test.

Ne joignez jamais `.env`, la valeur du cookie ou une clé d’accès.
