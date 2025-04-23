/*
  Warnings:

  - A unique constraint covering the columns `[messageId]` on the table `Transaction` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Transaction_messageId_key" ON "Transaction"("messageId");
