CREATE TYPE "TimeAllocationPeriod" AS ENUM ('WEEK', 'MONTH');

CREATE TABLE "TimeAllocationPeriodContext" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "period" "TimeAllocationPeriod" NOT NULL,
    "startDate" DATE NOT NULL,
    "budgetMinutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TimeAllocationPeriodContext_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PeriodicTimeAllocation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "period" "TimeAllocationPeriod" NOT NULL,
    "startDate" DATE NOT NULL,
    "plannedMinutes" INTEGER NOT NULL DEFAULT 0,
    "plannedMinutesManual" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PeriodicTimeAllocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TimeAllocationPeriodContext_userId_period_startDate_key"
ON "TimeAllocationPeriodContext"("userId", "period", "startDate");
CREATE INDEX "TimeAllocationPeriodContext_userId_startDate_idx"
ON "TimeAllocationPeriodContext"("userId", "startDate");
CREATE UNIQUE INDEX "PeriodicTimeAllocation_userId_categoryId_period_startDate_key"
ON "PeriodicTimeAllocation"("userId", "categoryId", "period", "startDate");
CREATE INDEX "PeriodicTimeAllocation_userId_period_startDate_idx"
ON "PeriodicTimeAllocation"("userId", "period", "startDate");

ALTER TABLE "TimeAllocationPeriodContext"
ADD CONSTRAINT "TimeAllocationPeriodContext_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PeriodicTimeAllocation"
ADD CONSTRAINT "PeriodicTimeAllocation_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PeriodicTimeAllocation"
ADD CONSTRAINT "PeriodicTimeAllocation_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "TimeAllocationCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
