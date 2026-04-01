-- CreateEnum
CREATE TYPE "BidRoundStatus" AS ENUM ('OPEN', 'CLOSED', 'AWARDED');

-- AlterTable
ALTER TABLE "Contract" ALTER COLUMN "contractorId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "BidRound" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "status" "BidRoundStatus" NOT NULL DEFAULT 'OPEN',
    "openedDay" INTEGER NOT NULL,
    "closesDay" INTEGER NOT NULL,
    "winnerContractorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BidRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bid" (
    "id" TEXT NOT NULL,
    "bidRoundId" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "daysToComplete" INTEGER NOT NULL,
    "qualityPledge" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BidRound_contractId_idx" ON "BidRound"("contractId");

-- CreateIndex
CREATE INDEX "BidRound_status_idx" ON "BidRound"("status");

-- CreateIndex
CREATE INDEX "Bid_bidRoundId_idx" ON "Bid"("bidRoundId");

-- CreateIndex
CREATE UNIQUE INDEX "Bid_bidRoundId_contractorId_key" ON "Bid"("bidRoundId", "contractorId");

-- AddForeignKey
ALTER TABLE "BidRound" ADD CONSTRAINT "BidRound_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidRound" ADD CONSTRAINT "BidRound_winnerContractorId_fkey" FOREIGN KEY ("winnerContractorId") REFERENCES "Contractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_bidRoundId_fkey" FOREIGN KEY ("bidRoundId") REFERENCES "BidRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
