ALTER TABLE "Task" ADD COLUMN "isDay" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "TaskTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TaskTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TaskTemplate_userId_createdAt_idx" ON "TaskTemplate"("userId", "createdAt");
ALTER TABLE "TaskTemplate" ADD CONSTRAINT "TaskTemplate_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
