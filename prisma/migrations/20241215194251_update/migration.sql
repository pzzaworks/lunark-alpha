/*
  Warnings:

  - A unique constraint covering the columns `[userId,chatId]` on the table `Usage` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Usage_chatId_key";

-- DropIndex
DROP INDEX "Usage_userId_key";

-- CreateIndex
CREATE UNIQUE INDEX "Usage_userId_chatId_key" ON "Usage"("userId", "chatId");
