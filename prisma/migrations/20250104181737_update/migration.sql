-- AlterTable
ALTER TABLE "Message" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "type" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "nonce" DROP DEFAULT;
