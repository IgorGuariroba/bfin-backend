-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "destination_account_id" TEXT,
ADD COLUMN     "source_account_id" TEXT;

-- CreateIndex
CREATE INDEX "transactions_source_account_id_idx" ON "transactions"("source_account_id");

-- CreateIndex
CREATE INDEX "transactions_destination_account_id_idx" ON "transactions"("destination_account_id");
