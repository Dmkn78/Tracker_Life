-- Backfill Task.sortOrder to preserve the display order tasks had before
-- manual reordering existed (date asc was already the partition, then
-- status asc, importance desc, createdAt asc — mirrors the previous
-- GET /api/tasks ordering in interface_API/app/routers/tasks.py).
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY "userId", "date"
      ORDER BY
        CASE "status"
          WHEN 'PLANNED' THEN 0
          WHEN 'IN_PROGRESS' THEN 1
          WHEN 'DONE' THEN 2
          WHEN 'POSTPONED' THEN 3
          WHEN 'CANCELLED' THEN 4
          ELSE 5
        END,
        CASE "importance"
          WHEN 'HIGH' THEN 0
          WHEN 'MEDIUM' THEN 1
          WHEN 'LOW' THEN 2
          ELSE 3
        END,
        "createdAt" ASC
    ) AS rn
  FROM "Task"
)
UPDATE "Task"
SET "sortOrder" = ranked.rn * 10
FROM ranked
WHERE "Task"."id" = ranked.id;
