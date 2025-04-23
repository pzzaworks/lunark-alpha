/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `Usage` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[chatId]` on the table `Usage` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Usage_userId_key" ON "Usage"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Usage_chatId_key" ON "Usage"("chatId");
