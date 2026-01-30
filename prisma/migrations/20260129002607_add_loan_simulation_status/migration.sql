-- CreateEnum
CREATE TYPE "LoanSimulationStatus" AS ENUM ('PENDING', 'APPROVED', 'COMPLETED');

-- AlterTable
ALTER TABLE "loan_simulations" ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "status" "LoanSimulationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "withdrawn_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "loan_simulations_status_idx" ON "loan_simulations"("status");

-- CreateIndex
CREATE INDEX "loan_simulations_user_id_status_idx" ON "loan_simulations"("user_id", "status");
