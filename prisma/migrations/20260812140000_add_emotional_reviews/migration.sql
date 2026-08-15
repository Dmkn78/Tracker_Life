CREATE TABLE IF NOT EXISTS "EmotionalReview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "emotions" JSONB NOT NULL,
    "factors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "stressLevel" INTEGER NOT NULL DEFAULT 0,
    "triggers" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "mentalSignals" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "physicalSignals" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "whatHelped" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "nextWeekAction" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmotionalReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmotionalReview_userId_weekId_key" ON "EmotionalReview"("userId", "weekId");
CREATE INDEX IF NOT EXISTS "EmotionalReview_userId_weekStart_idx" ON "EmotionalReview"("userId", "weekStart");

DO $$ BEGIN
  ALTER TABLE "EmotionalReview"
    ADD CONSTRAINT "EmotionalReview_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
