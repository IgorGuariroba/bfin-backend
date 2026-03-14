-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "indefinite" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recurrence_count" INTEGER;
