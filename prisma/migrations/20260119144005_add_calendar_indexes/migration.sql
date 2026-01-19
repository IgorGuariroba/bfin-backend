-- CreateIndex
CREATE INDEX "transactions_account_id_due_date_idx" ON "transactions"("account_id", "due_date");

-- CreateIndex
CREATE INDEX "transactions_type_due_date_idx" ON "transactions"("type", "due_date");

-- CreateIndex
CREATE INDEX "transactions_status_due_date_idx" ON "transactions"("status", "due_date");

-- CreateIndex
CREATE INDEX "transactions_category_id_due_date_idx" ON "transactions"("category_id", "due_date");

-- CreateIndex
CREATE INDEX "transactions_due_date_account_id_type_status_idx" ON "transactions"("due_date", "account_id", "type", "status");

-- CreateIndex
CREATE INDEX "transactions_due_date_amount_idx" ON "transactions"("due_date", "amount");
