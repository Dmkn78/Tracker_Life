CREATE TYPE "ObjectiveKind" AS ENUM ('OBJECTIVE', 'PROJECT', 'MILESTONE');
CREATE TYPE "ObjectiveHorizon" AS ENUM ('YEAR', 'QUARTER', 'MONTH', 'WEEK');
CREATE TYPE "ObjectiveStatus" AS ENUM ('PLANNED', 'ACTIVE', 'ON_TRACK', 'AT_RISK', 'PAUSED', 'DONE');
CREATE TYPE "ObjectivePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "WeeklyPlanCategory" AS ENUM ('WORK', 'STUDY', 'SPORT', 'REST', 'ADMIN', 'PERSONAL', 'SOCIAL', 'TRAVEL');

ALTER TABLE "Task" ADD COLUMN "objectiveId" TEXT;

CREATE TABLE "Objective" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentId" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "nextAction" TEXT,
    "kind" "ObjectiveKind" NOT NULL DEFAULT 'OBJECTIVE',
    "horizon" "ObjectiveHorizon" NOT NULL,
    "status" "ObjectiveStatus" NOT NULL DEFAULT 'PLANNED',
    "priority" "ObjectivePriority" NOT NULL DEFAULT 'MEDIUM',
    "targetDate" DATE,
    "weekId" TEXT,
    "color" TEXT NOT NULL DEFAULT '#8da2fb',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Objective_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WeeklyPlanBlock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "objectiveId" TEXT,
    "title" TEXT NOT NULL,
    "category" "WeeklyPlanCategory" NOT NULL DEFAULT 'WORK',
    "date" DATE NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "flexible" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyPlanBlock_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Task_userId_objectiveId_idx" ON "Task"("userId", "objectiveId");
CREATE INDEX "Objective_userId_archived_horizon_idx" ON "Objective"("userId", "archived", "horizon");
CREATE INDEX "Objective_userId_weekId_idx" ON "Objective"("userId", "weekId");
CREATE INDEX "Objective_parentId_idx" ON "Objective"("parentId");
CREATE INDEX "WeeklyPlanBlock_userId_date_idx" ON "WeeklyPlanBlock"("userId", "date");
CREATE INDEX "WeeklyPlanBlock_userId_objectiveId_idx" ON "WeeklyPlanBlock"("userId", "objectiveId");

ALTER TABLE "Task" ADD CONSTRAINT "Task_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "Objective"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Objective" ADD CONSTRAINT "Objective_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Objective" ADD CONSTRAINT "Objective_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Objective"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WeeklyPlanBlock" ADD CONSTRAINT "WeeklyPlanBlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeeklyPlanBlock" ADD CONSTRAINT "WeeklyPlanBlock_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "Objective"("id") ON DELETE SET NULL ON UPDATE CASCADE;
