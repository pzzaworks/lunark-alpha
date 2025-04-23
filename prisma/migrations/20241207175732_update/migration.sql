/*
  Warnings:

  - A unique constraint covering the columns `[threadId]` on the table `Chat` will be added. If there are existing duplicate values, this will fail.
  - The required column `threadId` was added to the `Chat` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE "Chat" ADD COLUMN     "threadId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Chat_threadId_key" ON "Chat"("threadId");
