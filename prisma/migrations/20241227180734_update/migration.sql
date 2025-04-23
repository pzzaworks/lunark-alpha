/*
  Warnings:

  - You are about to drop the column `context` on the `Memory` table. All the data in the column will be lost.
  - You are about to drop the column `embedding` on the `Memory` table. All the data in the column will be lost.
  - You are about to drop the column `tags` on the `Memory` table. All the data in the column will be lost.
  - Added the required column `userId` to the `Memory` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Memory" DROP COLUMN "context",
DROP COLUMN "embedding",
DROP COLUMN "tags",
ADD COLUMN     "chatId" TEXT,
ADD COLUMN     "metadata" TEXT,
ADD COLUMN     "userId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Memory_userId_type_idx" ON "Memory"("userId", "type");

-- CreateIndex
CREATE INDEX "Memory_chatId_type_idx" ON "Memory"("chatId", "type");
