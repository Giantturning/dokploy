ALTER TABLE "webServerSettings" DROP COLUMN IF EXISTS "tailscaleAuthKey";
ALTER TABLE "webServerSettings" ADD COLUMN IF NOT EXISTS "vpnInterface" text;
ALTER TABLE "webServerSettings" ADD COLUMN IF NOT EXISTS "vpnSubnet" text;
