/*
  Warnings:

  - A unique constraint covering the columns `[messageId]` on the table `Usage` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,chatId,messageId]` on the table `Usage` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `messageId` to the `Usage` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Usage_userId_chatId_key";

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "costBreakdown" TEXT;

-- AlterTable
ALTER TABLE "Usage" ADD COLUMN     "messageId" TEXT NOT NULL,
ADD COLUMN     "toolCost" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "Usage_messageId_key" ON "Usage"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "Usage_userId_chatId_messageId_key" ON "Usage"("userId", "chatId", "messageId");

-- AddForeignKey
ALTER TABLE "Usage" ADD CONSTRAINT "Usage_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
