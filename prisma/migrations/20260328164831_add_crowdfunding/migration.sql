-- CreateEnum
CREATE TYPE "CrowdfundingStatus" AS ENUM ('ACTIVE', 'FUNDED', 'MATCHED', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CrowdfundingCategory" AS ENUM ('PLAYGROUND', 'SCHOOL', 'ROADS', 'LANDSCAPING', 'COMMERCIAL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NftType" ADD VALUE 'DONOR_PARTICIPANT';
ALTER TYPE "NftType" ADD VALUE 'DONOR_PATRON';
ALTER TYPE "NftType" ADD VALUE 'DONOR_FOUNDER';
ALTER TYPE "NftType" ADD VALUE 'DONOR_CORPORATE';

-- CreateTable
CREATE TABLE "CrowdfundingCampaign" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "category" "CrowdfundingCategory" NOT NULL,
    "status" "CrowdfundingStatus" NOT NULL DEFAULT 'ACTIVE',
    "targetAmount" BIGINT NOT NULL,
    "citizenTarget" BIGINT NOT NULL,
    "stateMatch" BIGINT NOT NULL,
    "citizenRaised" BIGINT NOT NULL DEFAULT 0,
    "stateDeposited" BOOLEAN NOT NULL DEFAULT false,
    "donorCount" INTEGER NOT NULL DEFAULT 0,
    "deadline" TIMESTAMP(3) NOT NULL,
    "creatorId" TEXT NOT NULL,
    "contractId" TEXT,
    "onChainPubkey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrowdfundingCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignContribution" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "citizenId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "txSignature" TEXT,
    "nftMint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignContribution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CrowdfundingCampaign_contractId_key" ON "CrowdfundingCampaign"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "CrowdfundingCampaign_onChainPubkey_key" ON "CrowdfundingCampaign"("onChainPubkey");

-- CreateIndex
CREATE INDEX "CampaignContribution_campaignId_idx" ON "CampaignContribution"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignContribution_citizenId_idx" ON "CampaignContribution"("citizenId");

-- AddForeignKey
ALTER TABLE "CrowdfundingCampaign" ADD CONSTRAINT "CrowdfundingCampaign_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Citizen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrowdfundingCampaign" ADD CONSTRAINT "CrowdfundingCampaign_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignContribution" ADD CONSTRAINT "CampaignContribution_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "CrowdfundingCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignContribution" ADD CONSTRAINT "CampaignContribution_citizenId_fkey" FOREIGN KEY ("citizenId") REFERENCES "Citizen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
