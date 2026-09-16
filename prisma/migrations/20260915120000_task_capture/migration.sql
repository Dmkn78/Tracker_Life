CREATE TABLE "TaskCapture" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "taskId" TEXT UNIQUE,
  "title" TEXT NOT NULL,
  CONSTRAINT "TaskCapture_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TaskCapture_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "TaskCapture_userId_idx" ON "TaskCapture"("userId");
