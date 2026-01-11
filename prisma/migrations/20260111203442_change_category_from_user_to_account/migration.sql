/*
  Warnings:

  - You are about to drop the column `user_id` on the `categories` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "categories_user_id_type_idx";

-- AlterTable
ALTER TABLE "categories" DROP COLUMN "user_id",
ADD COLUMN     "account_id" TEXT;

-- CreateIndex
CREATE INDEX "categories_account_id_type_idx" ON "categories"("account_id", "type");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
