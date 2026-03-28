-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('ACTIVE', 'DISPUTED', 'PENALIZED', 'COMPLETED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "CitizenTier" AS ENUM ('NEW', 'ACTIVE', 'TRUSTED', 'GUARDIAN');

-- CreateEnum
CREATE TYPE "JurySessionStatus" AS ENUM ('SELECTING', 'COMMIT_PHASE', 'REVEAL_PHASE', 'FINALIZED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "VoteValue" AS ENUM ('ACCEPT', 'REJECT');

-- CreateEnum
CREATE TYPE "PenaltyType" AS ENUM ('TIME_OVERDUE', 'QUALITY_REJECTED', 'GHOST_SITE');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('DRAFT', 'VOTING', 'APPROVED', 'REJECTED', 'EXECUTED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW_RISK', 'MEDIUM_RISK', 'HIGH_RISK');

-- CreateEnum
CREATE TYPE "WorkLogType" AS ENUM ('DAILY_LOG', 'MILESTONE_CLAIM', 'BLOCKER', 'MATERIAL_DELIVERY');

-- CreateEnum
CREATE TYPE "ContractorRating" AS ENUM ('AAA', 'AA', 'A', 'B', 'C', 'BLACKLISTED');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('PENDING_UPVOTES', 'AI_RESEARCH', 'READY_FOR_BALLOT', 'ACTIVE_VOTE', 'FUNDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "Urgency" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "NftType" AS ENUM ('ACTIVE_CITIZEN', 'TRUSTED_CITIZEN', 'GUARDIAN_CITIZEN', 'CITY_BUILDER', 'FAIR_JUDGE', 'WHISTLEBLOWER', 'DISTRICT_CHAMPION');

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "district" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "contractorId" TEXT NOT NULL,
    "totalAmount" BIGINT NOT NULL,
    "escrowAmount" BIGINT NOT NULL,
    "penaltyAmount" BIGINT NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadline" TIMESTAMP(3) NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "category" TEXT,
    "onChainPubkey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "deadlineDays" INTEGER NOT NULL,
    "tranchePct" INTEGER NOT NULL,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'PENDING',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Citizen" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "iinHash" TEXT NOT NULL,
    "reputationScore" INTEGER NOT NULL DEFAULT 100,
    "tier" "CitizenTier" NOT NULL DEFAULT 'NEW',
    "isEligible" BOOLEAN NOT NULL DEFAULT true,
    "banUntil" TIMESTAMP(3),
    "votesCast" INTEGER NOT NULL DEFAULT 0,
    "votesWithMajority" INTEGER NOT NULL DEFAULT 0,
    "missedJuryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Citizen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JurySession" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "status" "JurySessionStatus" NOT NULL DEFAULT 'SELECTING',
    "vrfResult" TEXT,
    "commitDeadline" TIMESTAMP(3),
    "revealDeadline" TIMESTAMP(3),
    "result" "VoteValue",
    "weightedAccept" INTEGER NOT NULL DEFAULT 0,
    "weightedReject" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JurySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JuryVote" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "citizenId" TEXT NOT NULL,
    "isExpert" BOOLEAN NOT NULL DEFAULT false,
    "commitHash" TEXT,
    "revealedVote" "VoteValue",
    "revealedSalt" TEXT,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "rewardTenge" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JuryVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Penalty" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "type" "PenaltyType" NOT NULL,
    "amountTenge" BIGINT NOT NULL,
    "daysOverdue" INTEGER,
    "triggeredBy" TEXT,
    "txSignature" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Penalty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistrictTreasury" (
    "id" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "balance" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistrictTreasury_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpendingProposal" (
    "id" TEXT NOT NULL,
    "treasuryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "category" TEXT,
    "status" "ProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "votingEnds" TIMESTAMP(3),
    "votesFor" INTEGER NOT NULL DEFAULT 0,
    "votesAgainst" INTEGER NOT NULL DEFAULT 0,
    "quorumMet" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpendingProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalVote" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "citizenId" TEXT NOT NULL,
    "inFavor" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiResearchReport" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "swot" JSONB NOT NULL,
    "costAnalysis" JSONB NOT NULL,
    "similarProjects" JSONB NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "keyConcerns" JSONB NOT NULL,
    "keyPositives" JSONB NOT NULL,
    "sourcesUsed" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiResearchReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contractor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "walletAddress" TEXT,
    "rating" "ContractorRating" NOT NULL DEFAULT 'AA',
    "reputationScore" INTEGER NOT NULL DEFAULT 75,
    "onTimeRate" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "acceptanceRate" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "updateFrequency" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "gpsAccuracy" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "blockerSpeed" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contractor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkLog" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "type" "WorkLogType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "completionPct" INTEGER,
    "workersOnSite" INTEGER,
    "equipmentCount" INTEGER,
    "photoHashes" JSONB,
    "gpsLat" DOUBLE PRECISION,
    "gpsLng" DOUBLE PRECISION,
    "gpsValid" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CitizenSuggestion" (
    "id" TEXT NOT NULL,
    "citizenId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "problemDesc" TEXT NOT NULL,
    "suggestedFix" TEXT,
    "district" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "urgency" "Urgency" NOT NULL DEFAULT 'MEDIUM',
    "budgetMin" BIGINT,
    "budgetMax" BIGINT,
    "affectedCount" INTEGER,
    "photoHashes" JSONB,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'PENDING_UPVOTES',
    "upvotesNeeded" INTEGER NOT NULL,
    "upvotesReceived" INTEGER NOT NULL DEFAULT 0,
    "aiReportId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CitizenSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuggestionVote" (
    "id" TEXT NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "citizenId" TEXT NOT NULL,
    "isUpvote" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuggestionVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CitizenNft" (
    "id" TEXT NOT NULL,
    "citizenId" TEXT NOT NULL,
    "type" "NftType" NOT NULL,
    "metadata" JSONB,
    "mintAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CitizenNft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Contract_onChainPubkey_key" ON "Contract"("onChainPubkey");

-- CreateIndex
CREATE UNIQUE INDEX "Citizen_walletAddress_key" ON "Citizen"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Citizen_iinHash_key" ON "Citizen"("iinHash");

-- CreateIndex
CREATE UNIQUE INDEX "JuryVote_sessionId_citizenId_key" ON "JuryVote"("sessionId", "citizenId");

-- CreateIndex
CREATE UNIQUE INDEX "DistrictTreasury_district_key" ON "DistrictTreasury"("district");

-- CreateIndex
CREATE UNIQUE INDEX "ProposalVote_proposalId_citizenId_key" ON "ProposalVote"("proposalId", "citizenId");

-- CreateIndex
CREATE UNIQUE INDEX "AiResearchReport_proposalId_key" ON "AiResearchReport"("proposalId");

-- CreateIndex
CREATE UNIQUE INDEX "Contractor_walletAddress_key" ON "Contractor"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "CitizenSuggestion_aiReportId_key" ON "CitizenSuggestion"("aiReportId");

-- CreateIndex
CREATE UNIQUE INDEX "SuggestionVote_suggestionId_citizenId_key" ON "SuggestionVote"("suggestionId", "citizenId");

-- CreateIndex
CREATE UNIQUE INDEX "CitizenNft_citizenId_type_key" ON "CitizenNft"("citizenId", "type");

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JurySession" ADD CONSTRAINT "JurySession_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JurySession" ADD CONSTRAINT "JurySession_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryVote" ADD CONSTRAINT "JuryVote_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "JurySession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JuryVote" ADD CONSTRAINT "JuryVote_citizenId_fkey" FOREIGN KEY ("citizenId") REFERENCES "Citizen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Penalty" ADD CONSTRAINT "Penalty_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpendingProposal" ADD CONSTRAINT "SpendingProposal_treasuryId_fkey" FOREIGN KEY ("treasuryId") REFERENCES "DistrictTreasury"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalVote" ADD CONSTRAINT "ProposalVote_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "SpendingProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalVote" ADD CONSTRAINT "ProposalVote_citizenId_fkey" FOREIGN KEY ("citizenId") REFERENCES "Citizen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiResearchReport" ADD CONSTRAINT "AiResearchReport_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "SpendingProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkLog" ADD CONSTRAINT "WorkLog_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkLog" ADD CONSTRAINT "WorkLog_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CitizenSuggestion" ADD CONSTRAINT "CitizenSuggestion_citizenId_fkey" FOREIGN KEY ("citizenId") REFERENCES "Citizen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CitizenSuggestion" ADD CONSTRAINT "CitizenSuggestion_aiReportId_fkey" FOREIGN KEY ("aiReportId") REFERENCES "AiResearchReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestionVote" ADD CONSTRAINT "SuggestionVote_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "CitizenSuggestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestionVote" ADD CONSTRAINT "SuggestionVote_citizenId_fkey" FOREIGN KEY ("citizenId") REFERENCES "Citizen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CitizenNft" ADD CONSTRAINT "CitizenNft_citizenId_fkey" FOREIGN KEY ("citizenId") REFERENCES "Citizen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
