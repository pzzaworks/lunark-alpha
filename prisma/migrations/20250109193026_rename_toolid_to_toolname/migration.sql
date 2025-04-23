/*
  Warnings:

  - You are about to drop the column `toolId` on the `TokenToolSupport` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[toolName,deploymentId]` on the table `TokenToolSupport` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `toolName` to the `TokenToolSupport` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "TokenToolSupport_toolId_deploymentId_key";

-- AlterTable
ALTER TABLE "TokenToolSupport" DROP COLUMN "toolId",
ADD COLUMN     "toolName" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "TokenToolSupport_toolName_deploymentId_key" ON "TokenToolSupport"("toolName", "deploymentId");
