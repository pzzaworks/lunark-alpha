/*
  Warnings:

  - You are about to drop the column `edges` on the `Graph` table. All the data in the column will be lost.
  - You are about to drop the column `nodes` on the `Graph` table. All the data in the column will be lost.
  - Added the required column `graphId` to the `Edge` table without a default value. This is not possible if the table is not empty.
  - Added the required column `graphId` to the `Node` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Edge" ADD COLUMN     "graphId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Graph" DROP COLUMN "edges",
DROP COLUMN "nodes";

-- AlterTable
ALTER TABLE "Node" ADD COLUMN     "graphId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Node" ADD CONSTRAINT "Node_graphId_fkey" FOREIGN KEY ("graphId") REFERENCES "Graph"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Edge" ADD CONSTRAINT "Edge_graphId_fkey" FOREIGN KEY ("graphId") REFERENCES "Graph"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
