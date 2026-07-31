CREATE TABLE "TimeAllocationCategory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetWeight" INTEGER NOT NULL DEFAULT 0,
    "expectedReturn" INTEGER NOT NULL DEFAULT 50,
    "risk" INTEGER NOT NULL DEFAULT 50,
    "beta" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "color" TEXT NOT NULL DEFAULT '#22d3ee',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeAllocationCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DailyTimeAllocation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "plannedMinutes" INTEGER NOT NULL DEFAULT 0,
    "actualMinutes" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyTimeAllocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Habit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'routine',
    "description" TEXT,
    "targetTime" TEXT,
    "defaultExpectedMinutes" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Habit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HabitCheckin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "habitId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "actualMinutes" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HabitCheckin_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoutineBlock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "habitId" TEXT,
    "dayType" TEXT NOT NULL DEFAULT 'school_day',
    "label" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoutineBlock_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TimeAllocationCategory_userId_active_idx" ON "TimeAllocationCategory"("userId", "active");
CREATE UNIQUE INDEX "DailyTimeAllocation_userId_categoryId_date_key" ON "DailyTimeAllocation"("userId", "categoryId", "date");
CREATE INDEX "DailyTimeAllocation_userId_date_idx" ON "DailyTimeAllocation"("userId", "date");
CREATE INDEX "Habit_userId_active_idx" ON "Habit"("userId", "active");
CREATE UNIQUE INDEX "HabitCheckin_userId_habitId_date_key" ON "HabitCheckin"("userId", "habitId", "date");
CREATE INDEX "HabitCheckin_userId_date_idx" ON "HabitCheckin"("userId", "date");
CREATE INDEX "RoutineBlock_userId_dayType_active_idx" ON "RoutineBlock"("userId", "dayType", "active");

ALTER TABLE "TimeAllocationCategory" ADD CONSTRAINT "TimeAllocationCategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyTimeAllocation" ADD CONSTRAINT "DailyTimeAllocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyTimeAllocation" ADD CONSTRAINT "DailyTimeAllocation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TimeAllocationCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Habit" ADD CONSTRAINT "Habit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HabitCheckin" ADD CONSTRAINT "HabitCheckin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HabitCheckin" ADD CONSTRAINT "HabitCheckin_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoutineBlock" ADD CONSTRAINT "RoutineBlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoutineBlock" ADD CONSTRAINT "RoutineBlock_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
