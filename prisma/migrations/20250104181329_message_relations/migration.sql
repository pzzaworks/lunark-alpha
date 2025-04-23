/*
  Warnings:

  - You are about to drop the column `memoryId` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `toolData` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `sessionToken` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `sessionTokenExpiresAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `termsSignature` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `termsSignedAt` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[hash]` on the table `Transaction` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `Message` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Message` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `Transaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Transaction` table without a default value. This is not possible if the table is not empty.
  - Made the column `hash` on table `Transaction` required. This step will fail if there are existing NULL values in that column.
  - The required column `nonce` was added to the `User` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_memoryId_fkey";

-- AlterTable
ALTER TABLE "Memory" ALTER COLUMN "importance" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "Message" DROP COLUMN "memoryId",
DROP COLUMN "toolData",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "type" TEXT NOT NULL,
ADD COLUMN     "userId" TEXT NOT NULL,
ALTER COLUMN "hash" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "sessionToken",
DROP COLUMN "sessionTokenExpiresAt",
DROP COLUMN "termsSignature",
DROP COLUMN "termsSignedAt",
ADD COLUMN     "nonce" TEXT NOT NULL,
ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'user',
ALTER COLUMN "balance" SET DEFAULT 10;

-- CreateTable
CREATE TABLE "_MessageMemories" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_MessageMemories_AB_unique" ON "_MessageMemories"("A", "B");

-- CreateIndex
CREATE INDEX "_MessageMemories_B_index" ON "_MessageMemories"("B");

-- CreateIndex
CREATE INDEX "Memory_userId_idx" ON "Memory"("userId");

-- CreateIndex
CREATE INDEX "Memory_chatId_idx" ON "Memory"("chatId");

-- CreateIndex
CREATE INDEX "Message_chatId_idx" ON "Message"("chatId");

-- CreateIndex
CREATE INDEX "Message_userId_idx" ON "Message"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_hash_key" ON "Transaction"("hash");

-- CreateIndex
CREATE INDEX "Transaction_userId_idx" ON "Transaction"("userId");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MessageMemories" ADD CONSTRAINT "_MessageMemories_A_fkey" FOREIGN KEY ("A") REFERENCES "Memory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MessageMemories" ADD CONSTRAINT "_MessageMemories_B_fkey" FOREIGN KEY ("B") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add new columns with defaults
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);
UPDATE "Message" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL;
ALTER TABLE "Message" ALTER COLUMN "updatedAt" SET NOT NULL;
ALTER TABLE "Message" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "userId" TEXT;
UPDATE "Message" SET "userId" = (SELECT "id" FROM "User" LIMIT 1) WHERE "userId" IS NULL;
ALTER TABLE "Message" ALTER COLUMN "userId" SET NOT NULL;

ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "type" TEXT;
UPDATE "Transaction" SET "type" = 'UNKNOWN' WHERE "type" IS NULL;
ALTER TABLE "Transaction" ALTER COLUMN "type" SET NOT NULL;
ALTER TABLE "Transaction" ALTER COLUMN "type" SET DEFAULT 'UNKNOWN';

ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "userId" TEXT;
UPDATE "Transaction" SET "userId" = (SELECT "id" FROM "User" LIMIT 1) WHERE "userId" IS NULL;
ALTER TABLE "Transaction" ALTER COLUMN "userId" SET NOT NULL;

UPDATE "Transaction" SET "hash" = 'unknown' WHERE "hash" IS NULL;
ALTER TABLE "Transaction" ALTER COLUMN "hash" SET NOT NULL;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "nonce" TEXT;
UPDATE "User" SET "nonce" = gen_random_uuid()::TEXT WHERE "nonce" IS NULL;
ALTER TABLE "User" ALTER COLUMN "nonce" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "nonce" SET DEFAULT gen_random_uuid()::TEXT;

-- Add role column to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" TEXT;
UPDATE "User" SET "role" = 'user' WHERE "role" IS NULL;
ALTER TABLE "User" ALTER COLUMN "role" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'user';

-- Create indexes
DROP INDEX IF EXISTS "Message_chatId_idx";
DROP INDEX IF EXISTS "Message_userId_idx";
DROP INDEX IF EXISTS "Transaction_userId_idx";
DROP INDEX IF EXISTS "Memory_userId_idx";
DROP INDEX IF EXISTS "Memory_chatId_idx";

CREATE INDEX "Message_chatId_idx" ON "Message"("chatId");
CREATE INDEX "Message_userId_idx" ON "Message"("userId");
CREATE INDEX "Transaction_userId_idx" ON "Transaction"("userId");
CREATE INDEX "Memory_userId_idx" ON "Memory"("userId");
CREATE INDEX "Memory_chatId_idx" ON "Memory"("chatId");

-- Create unique constraint on Transaction hash
DROP INDEX IF EXISTS "Transaction_hash_key";
CREATE UNIQUE INDEX "Transaction_hash_key" ON "Transaction"("hash");

-- Drop unused columns
ALTER TABLE "Message" DROP COLUMN IF EXISTS "memoryId";
ALTER TABLE "Message" DROP COLUMN IF EXISTS "toolData";

ALTER TABLE "User" DROP COLUMN IF EXISTS "sessionToken";
ALTER TABLE "User" DROP COLUMN IF EXISTS "sessionTokenExpiresAt";
ALTER TABLE "User" DROP COLUMN IF EXISTS "termsSignature";
ALTER TABLE "User" DROP COLUMN IF EXISTS "termsSignedAt";
