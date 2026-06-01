DO $$ BEGIN
 CREATE TYPE "public"."accessMode" AS ENUM('public', 'tailscale', 'both');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "application" ADD COLUMN IF NOT EXISTS "accessMode" "accessMode" DEFAULT 'public';
ALTER TABLE "application" ADD COLUMN IF NOT EXISTS "tailscaleHostname" text;
ALTER TABLE "application" ADD COLUMN IF NOT EXISTS "tailscalePort" integer DEFAULT 3000;
ALTER TABLE "application" ADD COLUMN IF NOT EXISTS "snapshotBeforeDeploy" boolean DEFAULT false;
ALTER TABLE "webServerSettings" ADD COLUMN IF NOT EXISTS "tailscaleAuthKey" text;
