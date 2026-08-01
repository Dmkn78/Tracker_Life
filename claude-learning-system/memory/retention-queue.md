# retention-queue — rappels différés planifiés

> Trié par date d'échéance. Maximum de trois rappels servis par session.

## Échus / à venir

- [due: 2026-08-02] [it/python/execution] Q: "Sans regarder le cours, retrace l'ordre entre `python run.py`, l'import de `app.main:app`, l'enregistrement des décorateurs et l'arrivée d'une première requête." | réponse_attendue: "`run.py` charge la configuration et lance Uvicorn ; Uvicorn importe `app.main`, dont l'import crée l'application et enregistre handlers/routeurs ; la fonction de route n'est appelée qu'à l'arrivée d'une requête correspondante." | indice: distinguer import et requête | piège: croire que le corps des routes s'exécute pendant l'import | hist: 2026-08-01 créé
- [due: 2026-08-02] [it/python-api/transaction] Q: "Qui crée la session SQLAlchemy, à quel moment `commit` s'exécute-t-il et quel chemin provoque `rollback` ?" | réponse_attendue: "`get_db` crée `SessionLocal`, la cède avec `yield`, appelle `commit` après une route réussie, ou `rollback` lorsqu'une exception remonte, puis ferme toujours la session." | indice: relire le générateur autour de `yield` | piège: confondre `flush` avec `commit` | hist: 2026-08-01 créé

## Historique (purgé à la consolidation mensuelle)
