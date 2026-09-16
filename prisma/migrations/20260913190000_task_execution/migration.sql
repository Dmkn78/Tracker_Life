ALTER TABLE "WeeklyPlanBlock" ADD COLUMN "taskId" TEXT;
ALTER TABLE "WeeklyPlanBlock" ADD CONSTRAINT "WeeklyPlanBlock_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "WeeklyPlanBlock_taskId_date_key" ON "WeeklyPlanBlock"("taskId", "date");
