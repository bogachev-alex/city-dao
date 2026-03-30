-- Align with goszakup.gov.kz contract registry fields (customer, subject type, registry number)
ALTER TABLE "Contract" ADD COLUMN "registryNumber" TEXT;
ALTER TABLE "Contract" ADD COLUMN "customerName" TEXT;
ALTER TABLE "Contract" ADD COLUMN "subjectType" TEXT;

CREATE UNIQUE INDEX "Contract_registryNumber_key" ON "Contract"("registryNumber");
