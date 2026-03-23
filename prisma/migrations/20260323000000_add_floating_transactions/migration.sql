-- AlterTable: tornar due_date opcional e adicionar flag is_floating
ALTER TABLE "transactions"
  ALTER COLUMN "due_date" DROP NOT NULL,
  ADD COLUMN "is_floating" BOOLEAN NOT NULL DEFAULT false;

-- Index para consultas de dívidas flutuantes
CREATE INDEX "transactions_account_id_is_floating_idx"
  ON "transactions"("account_id", "is_floating");
