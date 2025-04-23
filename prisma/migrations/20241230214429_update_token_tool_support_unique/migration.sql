/*
  Warnings:

  - A unique constraint covering the columns `[toolId,tokenId]` on the table `TokenToolSupport` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[toolId,deploymentId]` on the table `TokenToolSupport` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "TokenToolSupport_toolId_tokenId_deploymentId_key";

-- CreateIndex
CREATE UNIQUE INDEX "TokenToolSupport_toolId_tokenId_key" ON "TokenToolSupport"("toolId", "tokenId");

-- CreateIndex
CREATE UNIQUE INDEX "TokenToolSupport_toolId_deploymentId_key" ON "TokenToolSupport"("toolId", "deploymentId");
