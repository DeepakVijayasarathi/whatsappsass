-- AlterTable: add per-tenant Meta WhatsApp credentials to workspaces
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "meta_phone_number_id" TEXT;
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "meta_access_token" TEXT;
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "meta_webhook_verify_token" TEXT;
