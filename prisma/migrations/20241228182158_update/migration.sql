-- AlterTable
ALTER TABLE "Graph" ADD COLUMN     "metadata" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACTIVE';
