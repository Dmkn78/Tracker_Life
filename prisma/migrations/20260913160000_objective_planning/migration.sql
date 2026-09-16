CREATE TABLE "ObjectivePlan" (
  "objectiveId" TEXT PRIMARY KEY REFERENCES "Objective"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "startDate" DATE NOT NULL,
  "effortMinutes" INTEGER NOT NULL DEFAULT 0 CHECK ("effortMinutes" >= 0),
  "impact" INTEGER NOT NULL DEFAULT 50 CHECK ("impact" BETWEEN 0 AND 100),
  "manualProgress" INTEGER CHECK ("manualProgress" BETWEEN 0 AND 100),
  "ignoredUntil" DATE
);
CREATE TABLE "ObjectiveProgressEntry" (
  "objectiveId" TEXT NOT NULL REFERENCES "Objective"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "date" DATE NOT NULL,
  "progress" INTEGER NOT NULL CHECK ("progress" BETWEEN 0 AND 100),
  "source" TEXT NOT NULL DEFAULT 'execution',
  PRIMARY KEY ("objectiveId", "date")
);
CREATE TABLE "TaskPlan" (
  "taskId" TEXT PRIMARY KEY REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "optimisticMinutes" INTEGER NOT NULL CHECK ("optimisticMinutes" > 0),
  "likelyMinutes" INTEGER NOT NULL,
  "pessimisticMinutes" INTEGER NOT NULL,
  "predecessorIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  CHECK ("optimisticMinutes" <= "likelyMinutes" AND "likelyMinutes" <= "pessimisticMinutes")
);
CREATE TABLE "BlockRecovery" (
  "blockId" TEXT PRIMARY KEY REFERENCES "WeeklyPlanBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "action" TEXT NOT NULL CHECK ("action" IN ('replan', 'ignore')),
  "replacementId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
