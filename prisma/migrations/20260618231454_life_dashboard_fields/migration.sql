-- AlterTable
ALTER TABLE "DailyLog" ADD COLUMN     "avoidedImportantTask" BOOLEAN,
ADD COLUMN     "distractionTimeMinutes" INTEGER,
ADD COLUMN     "focusQuality" INTEGER,
ADD COLUMN     "improvementTomorrow" TEXT,
ADD COLUMN     "mainBlocker" TEXT,
ADD COLUMN     "mentalFatigue" INTEGER,
ADD COLUMN     "physicalFatigue" INTEGER,
ADD COLUMN     "workTimeMinutes" INTEGER;
