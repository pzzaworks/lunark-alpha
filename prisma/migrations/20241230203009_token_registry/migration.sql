-- CreateTable
CREATE TABLE "Token" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "commonNames" TEXT[],
    "logoURI" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenDeployment" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "decimals" INTEGER NOT NULL,
    "isNative" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tokenId" TEXT NOT NULL,

    CONSTRAINT "TokenDeployment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenToolSupport" (
    "id" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "minAmount" TEXT,
    "maxAmount" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tokenId" TEXT,
    "deploymentId" TEXT,
    "params" JSONB,

    CONSTRAINT "TokenToolSupport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Token_symbol_name_key" ON "Token"("symbol", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TokenDeployment_address_chainId_key" ON "TokenDeployment"("address", "chainId");

-- CreateIndex
CREATE UNIQUE INDEX "TokenToolSupport_toolId_tokenId_deploymentId_key" ON "TokenToolSupport"("toolId", "tokenId", "deploymentId");

-- AddForeignKey
ALTER TABLE "TokenDeployment" ADD CONSTRAINT "TokenDeployment_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "Token"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenToolSupport" ADD CONSTRAINT "TokenToolSupport_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "Token"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenToolSupport" ADD CONSTRAINT "TokenToolSupport_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "TokenDeployment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
