-- AlterTable
ALTER TABLE "Penalty" ADD COLUMN "districtTreasuryId" TEXT;

-- AddForeignKey
ALTER TABLE "Penalty" ADD CONSTRAINT "Penalty_districtTreasuryId_fkey" FOREIGN KEY ("districtTreasuryId") REFERENCES "DistrictTreasury"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: link existing penalties to the correct district treasury
UPDATE "Penalty" p
SET "districtTreasuryId" = dt.id
FROM "Contract" c, "DistrictTreasury" dt
WHERE p."contractId" = c.id AND c.district = dt.district;
