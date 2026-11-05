CREATE TABLE "AiProvider" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT '',
    "encryptedApiKey" TEXT,
    "apiKeyHint" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiProvider_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiProvider_userId_idx" ON "AiProvider"("userId");
ALTER TABLE "AiProvider" ADD CONSTRAINT "AiProvider_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WeeklyRecap" (
    "userId" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WeeklyRecap_pkey" PRIMARY KEY ("userId", "weekId")
);

ALTER TABLE "WeeklyRecap" ADD CONSTRAINT "WeeklyRecap_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
