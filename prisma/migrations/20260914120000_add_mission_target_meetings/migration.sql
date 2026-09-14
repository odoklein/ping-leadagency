-- Mission RDV target, set at creation and pro-rated per week on the manager
-- dashboard. Purely additive and nullable: existing rows keep no target, and the
-- dashboard falls back to its previous behaviour when none is set.
ALTER TABLE "Mission" ADD COLUMN IF NOT EXISTS "targetMeetings" INTEGER;
