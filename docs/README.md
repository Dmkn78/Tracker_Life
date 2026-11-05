# Documentation du Life Regime Tracker

Cette documentation décrit le code réellement présent dans le dépôt après sa restructuration. Elle distingue clairement le frontend, l’API, la base de données et le service de transcription. Lorsqu’une information n’existe pas dans le projet, elle est signalée au lieu d’être inventée.

## Ordre de lecture conseillé

### Je débute totalement

1. [`01-DEBUTER.md`](01-DEBUTER.md) — installer et lancer l’application.
2. [`02-FONDAMENTAUX-DU-CODE.md`](02-FONDAMENTAUX-DU-CODE.md) — comprendre les mots essentiels.
3. [`ARCHITECTURE.md`](ARCHITECTURE.md) — suivre une donnée de l’écran jusqu’à PostgreSQL.
4. [`04-FRONTEND-NEXT-REACT.md`](04-FRONTEND-NEXT-REACT.md) — comprendre l’interface.
5. [`05-API-FASTAPI-HTTP.md`](05-API-FASTAPI-HTTP.md) — comprendre l’API Python.
6. [`06-BASE-DE-DONNEES.md`](06-BASE-DE-DONNEES.md) — comprendre les tables et migrations.
7. [`11-GLOSSAIRE.md`](11-GLOSSAIRE.md) — revenir sur un terme inconnu.

Le parcours Todo est le meilleur fil rouge :

```text
/todo
→ app/todo/page.tsx
→ features/todo/components/TodoClient.tsx
→ features/todo/api/todoApi.ts
→ app/api/tasks/route.ts
→ interface_API/app/contracts/tasks.py
→ interface_API/app/routers/tasks.py
→ interface_API/app/models.py
→ PostgreSQL
```

### Je travaille surtout sur le frontend

- [`ARCHITECTURE.md`](ARCHITECTURE.md)
- [`04-FRONTEND-NEXT-REACT.md`](04-FRONTEND-NEXT-REACT.md)
- [`07-CONFIGURATION-ET-SERVICES.md`](07-CONFIGURATION-ET-SERVICES.md)
- [`08-MAINTENANCE-ET-REGLES.md`](08-MAINTENANCE-ET-REGLES.md)
- [`10-CARTE-DES-FICHIERS.md`](10-CARTE-DES-FICHIERS.md)

### Je travaille surtout sur l’API ou la base

- [`05-API-FASTAPI-HTTP.md`](05-API-FASTAPI-HTTP.md)
- [`06-BASE-DE-DONNEES.md`](06-BASE-DE-DONNEES.md)
- [`interface_API/README.md`](../interface_API/README.md)
- [`09-TESTS-ET-DEPANNAGE.md`](09-TESTS-ET-DEPANNAGE.md)

### Je dois maintenir ou faire évoluer le projet

- [`08-MAINTENANCE-ET-REGLES.md`](08-MAINTENANCE-ET-REGLES.md)
- [`09-TESTS-ET-DEPANNAGE.md`](09-TESTS-ET-DEPANNAGE.md)
- [`10-CARTE-DES-FICHIERS.md`](10-CARTE-DES-FICHIERS.md)
- [`whisper.md`](whisper.md)

## Carte des documents

| Document | Question à laquelle il répond |
| --- | --- |
| [`01-DEBUTER.md`](01-DEBUTER.md) | Comment installer, lancer et vérifier le projet ? |
| [`02-FONDAMENTAUX-DU-CODE.md`](02-FONDAMENTAUX-DU-CODE.md) | Que signifient variable, fonction, import, type et module ? |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Comment les couches communiquent-elles ? |
| [`04-FRONTEND-NEXT-REACT.md`](04-FRONTEND-NEXT-REACT.md) | Comment sont organisés Next.js, React et les features ? |
| [`05-API-FASTAPI-HTTP.md`](05-API-FASTAPI-HTTP.md) | Quelles routes existent et comment fonctionne FastAPI ? |
| [`06-BASE-DE-DONNEES.md`](06-BASE-DE-DONNEES.md) | Quelles tables existent et comment les modifier ? |
| [`07-CONFIGURATION-ET-SERVICES.md`](07-CONFIGURATION-ET-SERVICES.md) | Quels services, ports, scripts et variables `.env` utiliser ? |
| [`08-MAINTENANCE-ET-REGLES.md`](08-MAINTENANCE-ET-REGLES.md) | Comment ajouter du code sans réintroduire le chaos ? |
| [`09-TESTS-ET-DEPANNAGE.md`](09-TESTS-ET-DEPANNAGE.md) | Comment vérifier une modification et diagnostiquer une panne ? |
| [`10-CARTE-DES-FICHIERS.md`](10-CARTE-DES-FICHIERS.md) | Quel est le rôle de chaque fichier important ? |
| [`11-GLOSSAIRE.md`](11-GLOSSAIRE.md) | Quelle est la définition simple d’un terme ? |
| [`whisper.md`](whisper.md) | Comment fonctionne la transcription locale ? |
| [`REFONTE.md`](REFONTE.md) | Pourquoi l’interface a été simplifiée, comment fonctionnent l’IA multi-fournisseurs, le coffre Obsidian et les analyses ? |
| [`lm-studio-assistant.md`](lm-studio-assistant.md) | Comment dicter des tâches et analyser mes journées avec un modèle d’IA ? |

## État et limites connues

- Le code métier persistant passe par FastAPI ; Prisma reste utilisé directement par Next.js uniquement pour l’identité/session locale et pour les migrations.
- Le mapping SQLAlchemy est maintenu manuellement en parallèle du schéma Prisma.
- Les tests présents couvrent surtout les contrats, la sécurité, les frontières HTTP et la parité de calcul.
- Aucun test React, test de bout en bout, test d’intégration PostgreSQL ou test automatisé du modèle Whisper n’est présent.
- La procédure de déploiement en production, la CI/CD, la sauvegarde PostgreSQL et le rollback de migration ne sont pas documentés dans le dépôt.
- Les versions minimales de Node.js et Python ne sont pas déclarées. Ne pas en déduire une valeur sans la tester et l’ajouter explicitement.
