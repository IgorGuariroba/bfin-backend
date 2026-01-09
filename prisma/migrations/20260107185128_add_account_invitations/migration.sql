-- AlterTable
ALTER TABLE "account_members" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "account_invitations" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "invited_email" TEXT NOT NULL,
    "invited_by" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "account_invitations_token_key" ON "account_invitations"("token");

-- CreateIndex
CREATE UNIQUE INDEX "account_invitations_account_id_invited_email_status_key" ON "account_invitations"("account_id", "invited_email", "status");

-- CreateIndex
CREATE INDEX "account_invitations_invited_email_status_idx" ON "account_invitations"("invited_email", "status");

-- CreateIndex
CREATE INDEX "account_invitations_token_idx" ON "account_invitations"("token");

-- CreateIndex
CREATE INDEX "account_members_user_id_idx" ON "account_members"("user_id");

-- CreateIndex
CREATE INDEX "account_members_account_id_idx" ON "account_members"("account_id");

-- AddForeignKey
ALTER TABLE "account_invitations" ADD CONSTRAINT "account_invitations_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_invitations" ADD CONSTRAINT "account_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
