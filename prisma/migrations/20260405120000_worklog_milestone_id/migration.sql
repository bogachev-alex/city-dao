-- Optional link from work log to milestone (evidence for jury)
ALTER TABLE "WorkLog" ADD COLUMN "milestoneId" TEXT;

ALTER TABLE "WorkLog" ADD CONSTRAINT "WorkLog_milestoneId_fkey"
  FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
