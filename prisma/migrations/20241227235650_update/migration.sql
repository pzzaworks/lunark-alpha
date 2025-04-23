-- DropIndex
DROP INDEX "Memory_chatId_type_idx";

-- DropIndex
DROP INDEX "Memory_userId_type_idx";

-- DropIndex
DROP INDEX "Node_graphId_idx";

-- DropIndex
DROP INDEX "Task_createdBy_idx";

-- DropIndex
DROP INDEX "Task_status_idx";

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_graphId_fkey" FOREIGN KEY ("graphId") REFERENCES "Graph"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memory" ADD CONSTRAINT "Memory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memory" ADD CONSTRAINT "Memory_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE SET NULL ON UPDATE CASCADE;
