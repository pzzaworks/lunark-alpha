/*
  Warnings:

  - You are about to drop the column `llmProvider` on the `UserSettings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "UserSettings" DROP COLUMN "llmProvider",
ALTER COLUMN "llmModel" SET DEFAULT 'gpt-4-turbo-preview';
