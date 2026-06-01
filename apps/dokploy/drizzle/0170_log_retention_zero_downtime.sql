ALTER TABLE "application" ADD COLUMN IF NOT EXISTS "logMaxSize" text;
ALTER TABLE "application" ADD COLUMN IF NOT EXISTS "logMaxFiles" text;
ALTER TABLE "application" ADD COLUMN IF NOT EXISTS "zeroDowntime" boolean DEFAULT true;
