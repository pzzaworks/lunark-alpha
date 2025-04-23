/*
  Warnings:

  - A unique constraint covering the columns `[userId,chatId]` on the table `Usage` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,chatId,messageId]` on the table `Usage` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[address]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "notes" TEXT,
    "networks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" TEXT DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Contact_userId_idx" ON "Contact"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_userId_name_deletedAt_key" ON "Contact"("userId", "name", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Usage_userId_chatId_key" ON "Usage"("userId", "chatId");

-- CreateIndex
CREATE UNIQUE INDEX "Usage_userId_chatId_messageId_key" ON "Usage"("userId", "chatId", "messageId");

-- CreateIndex
CREATE UNIQUE INDEX "User_address_key" ON "User"("address");

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
