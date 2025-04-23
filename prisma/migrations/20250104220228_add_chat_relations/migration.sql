/*
  Warnings:

  - Added the required column `chatId` to the `Task` table without a default value. This is not possible if the table is not empty.
  - Added the required column `chatId` to the `documents` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "chatId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "chatId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Task_chatId_idx" ON "Task"("chatId");

-- CreateIndex
CREATE INDEX "documents_chatId_idx" ON "documents"("chatId");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
