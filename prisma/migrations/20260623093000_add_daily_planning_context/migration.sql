ALTER TABLE "DailyTimeAllocation"
ADD COLUMN "plannedMinutesManual" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "DailyPlanningContext" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "dayBudgetMinutes" INTEGER NOT NULL DEFAULT 720,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyPlanningContext_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyPlanningContext_userId_date_key" ON "DailyPlanningContext"("userId", "date");
CREATE INDEX "DailyPlanningContext_userId_date_idx" ON "DailyPlanningContext"("userId", "date");

ALTER TABLE "DailyPlanningContext"
ADD CONSTRAINT "DailyPlanningContext_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
