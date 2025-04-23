/*
  Warnings:

  - You are about to drop the column `memoryid` on the `Message` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_memoryid_fkey";

-- AlterTable
ALTER TABLE "Message" DROP COLUMN "memoryid",
ADD COLUMN     "memoryId" TEXT;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "Memory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
