-- AlterTable
ALTER TABLE "Node" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "Node_graphId_idx" ON "Node"("graphId");
