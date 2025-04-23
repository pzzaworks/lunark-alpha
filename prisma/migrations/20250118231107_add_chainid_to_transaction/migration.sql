/*
  Warnings:

  - Added the required column `chainId` to the `Transaction` table without a default value. This is not possible if the table is not empty.

*/
-- First add the column as nullable
ALTER TABLE "Transaction" ADD COLUMN "chainId" INTEGER;

-- Update existing records with default value (1 for Ethereum mainnet)
UPDATE "Transaction" SET "chainId" = 1 WHERE "chainId" IS NULL;

-- Make the column required
ALTER TABLE "Transaction" ALTER COLUMN "chainId" SET NOT NULL;

-- Set the default type for new records
ALTER TABLE "Transaction" ALTER COLUMN "type" SET DEFAULT 'TRANSFER';
