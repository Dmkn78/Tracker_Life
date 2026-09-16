ALTER TABLE "Task" ADD COLUMN "completedAt" TIMESTAMP(3);
ALTER TABLE "Objective" ADD COLUMN "completedAt" TIMESTAMP(3), ADD COLUMN "completionDeadline" DATE;
ALTER TABLE "WeeklyPlanBlock" ADD COLUMN "actualMinutes" INTEGER,
    ADD COLUMN "executionStatus" TEXT NOT NULL DEFAULT 'planned';
ALTER TABLE "WeeklyPlanBlock" ADD CONSTRAINT "WeeklyPlanBlock_actualMinutes_check"
    CHECK ("actualMinutes" IS NULL OR "actualMinutes" BETWEEN 0 AND 1440);
ALTER TABLE "WeeklyPlanBlock" ADD CONSTRAINT "WeeklyPlanBlock_executionStatus_check"
    CHECK ("executionStatus" IN ('planned', 'done', 'partial', 'not_done'));
CREATE TABLE "PerformanceWeek" (
    "userId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "targetMinutes" INTEGER NOT NULL DEFAULT 2400 CHECK ("targetMinutes" BETWEEN 60 AND 10080),
    CONSTRAINT "PerformanceWeek_pkey" PRIMARY KEY ("userId", "weekStart"),
    CONSTRAINT "PerformanceWeek_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
