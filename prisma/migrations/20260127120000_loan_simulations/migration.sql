-- CreateTable
CREATE TABLE "loan_simulations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "principal_amount" DECIMAL(15,2) NOT NULL,
    "term_months" INTEGER NOT NULL,
    "interest_rate_monthly" DECIMAL(7,4) NOT NULL,
    "amortization_type" TEXT NOT NULL DEFAULT 'PRICE',
    "total_interest" DECIMAL(15,2) NOT NULL,
    "total_cost" DECIMAL(15,2) NOT NULL,
    "installment_amount" DECIMAL(15,2) NOT NULL,
    "reserve_usage_percent" DECIMAL(5,2) NOT NULL,
    "reserve_remaining_amount" DECIMAL(15,2) NOT NULL,
    "monthly_cashflow_impact" DECIMAL(15,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loan_simulations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installment_plans" (
    "id" TEXT NOT NULL,
    "simulation_id" TEXT NOT NULL,
    "installment_number" INTEGER NOT NULL,
    "principal_component" DECIMAL(15,2) NOT NULL,
    "interest_component" DECIMAL(15,2) NOT NULL,
    "total_payment" DECIMAL(15,2) NOT NULL,
    "remaining_balance" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "installment_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_flow_impacts" (
    "id" TEXT NOT NULL,
    "simulation_id" TEXT NOT NULL,
    "monthly_outflow" DECIMAL(15,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_flow_impacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "simulation_id" TEXT,
    "event_type" TEXT NOT NULL,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "loan_simulations_user_id_created_at_idx" ON "loan_simulations"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "loan_simulations_account_id_created_at_idx" ON "loan_simulations"("account_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "installment_plans_simulation_id_installment_number_key" ON "installment_plans"("simulation_id", "installment_number");

-- CreateIndex
CREATE INDEX "installment_plans_simulation_id_idx" ON "installment_plans"("simulation_id");

-- CreateIndex
CREATE UNIQUE INDEX "cash_flow_impacts_simulation_id_key" ON "cash_flow_impacts"("simulation_id");

-- CreateIndex
CREATE INDEX "audit_events_user_id_created_at_idx" ON "audit_events"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_events_account_id_created_at_idx" ON "audit_events"("account_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_events_simulation_id_idx" ON "audit_events"("simulation_id");

-- AddForeignKey
ALTER TABLE "loan_simulations" ADD CONSTRAINT "loan_simulations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_simulations" ADD CONSTRAINT "loan_simulations_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installment_plans" ADD CONSTRAINT "installment_plans_simulation_id_fkey" FOREIGN KEY ("simulation_id") REFERENCES "loan_simulations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_flow_impacts" ADD CONSTRAINT "cash_flow_impacts_simulation_id_fkey" FOREIGN KEY ("simulation_id") REFERENCES "loan_simulations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_simulation_id_fkey" FOREIGN KEY ("simulation_id") REFERENCES "loan_simulations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
