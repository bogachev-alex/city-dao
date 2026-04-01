-- AlterTable
ALTER TABLE "DistrictTreasury" ADD COLUMN "walletAddress" TEXT;

-- Populate existing records with real Solana wallet addresses
UPDATE "DistrictTreasury" SET "walletAddress" = '3zuYfqNAXFy8RYYSo6guiXXRPNc1hTvw7CFiLUnXoQWp' WHERE "district" = 'Алатауский';
UPDATE "DistrictTreasury" SET "walletAddress" = 'A4vodzfg9iJho5brepy1nApxKQ1heDHwGE3ByDNesLSD' WHERE "district" = 'Алмалинский';
UPDATE "DistrictTreasury" SET "walletAddress" = '3it6N2wRR12CaTc7un5ogw3mYQV8rjLyZPvN8mr3FTbg' WHERE "district" = 'Ауэзовский';
UPDATE "DistrictTreasury" SET "walletAddress" = '6fqUBQXQZ8KTGQcY8FLbNEePq1gSjhnRvcwPaDzPkPHt' WHERE "district" = 'Бостандыкский';
UPDATE "DistrictTreasury" SET "walletAddress" = 'CRnhVGDha3F1Y9tBP5XGG1kGhEREZfJ8GqDz5yEJVwtn' WHERE "district" = 'Жетысуский';
UPDATE "DistrictTreasury" SET "walletAddress" = 'RZEyiFoF7Qi3T4FNmkZMxWjWYb9V9Aq1KX7deG4wzN9' WHERE "district" = 'Медеуский';
UPDATE "DistrictTreasury" SET "walletAddress" = 'Hj6xtnYmDqJ4qtaVrBT15o4HcuGeJTPETik3z7x2FW5X' WHERE "district" = 'Наурызбайский';
UPDATE "DistrictTreasury" SET "walletAddress" = 'DfMP5oCHSQuapyAZT6maSgNjMBoghPam6zopTC5VpXVd' WHERE "district" = 'Турксибский';

-- CreateIndex
CREATE UNIQUE INDEX "DistrictTreasury_walletAddress_key" ON "DistrictTreasury"("walletAddress");
