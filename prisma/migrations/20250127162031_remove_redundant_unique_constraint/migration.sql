-- DropIndex
DROP INDEX "Usage_userId_chatId_messageId_key";

-- CreateIndex
CREATE INDEX "Usage_userId_idx" ON "Usage"("userId");

-- CreateIndex
CREATE INDEX "Usage_chatId_idx" ON "Usage"("chatId");
