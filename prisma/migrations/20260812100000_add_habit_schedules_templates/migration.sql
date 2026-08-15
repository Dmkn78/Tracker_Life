ALTER TABLE "Habit"
ADD COLUMN IF NOT EXISTS "recurrenceDays" INTEGER[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5, 6, 7],
ADD COLUMN IF NOT EXISTS "timeBlockEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "RoutineBlock"
ADD COLUMN IF NOT EXISTS "recurrenceDays" INTEGER[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5, 6, 7];

CREATE TABLE IF NOT EXISTS "HabitTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'routine',
    "description" TEXT,
    "targetTime" TEXT,
    "defaultExpectedMinutes" INTEGER NOT NULL DEFAULT 0,
    "recurrenceDays" INTEGER[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5, 6, 7],
    "timeBlockEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HabitTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "HabitTemplate_userId_createdAt_idx"
ON "HabitTemplate"("userId", "createdAt");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'HabitTemplate_userId_fkey'
    ) THEN
        ALTER TABLE "HabitTemplate"
        ADD CONSTRAINT "HabitTemplate_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
