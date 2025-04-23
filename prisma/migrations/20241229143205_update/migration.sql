-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "memoryid" TEXT;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_memoryid_fkey" FOREIGN KEY ("memoryid") REFERENCES "Memory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
