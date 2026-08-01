# session-debriefs — historique append-only

## [2026-08-01] SessionDebrief — manuel de l'API Python

- COMPRIS : non évalué ; le livrable a été créé, mais aucune production d'apprentissage de l'utilisateur n'a encore été corrigée.
- FRAGILE : syntaxe Python et cycle complet d'une requête restent à reconstruire activement.
- ERREUR COGNITIVE PRINCIPALE : aucune erreur d'apprentissage observée ; le premier brouillon était objectivement trop partiel et a été remplacé par un manuel exhaustif.
- MEILLEUR ANCRAGE PROPOSÉ : Client → proxy Next.js → FastAPI → `Depends` → route → `core` → SQLAlchemy → PostgreSQL → JSON.
- EXERCICE À REFAIRE : après les chapitres 01 à 04, expliquer sans notes pourquoi `db.flush()` ne valide pas encore la transaction.
- RAPPELS PLANIFIÉS : 2026-08-02, ordre d'exécution et transaction par requête.
