-- AlterTable
ALTER TABLE "User" ADD COLUMN     "sessionToken" TEXT,
ADD COLUMN     "sessionTokenExpiresAt" TIMESTAMP(3);
