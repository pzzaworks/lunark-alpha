-- AlterTable
ALTER TABLE "Memory" ADD COLUMN     "embedding" TEXT,
ADD COLUMN     "tags" TEXT,
ALTER COLUMN "importance" DROP DEFAULT;
