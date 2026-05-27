-- AlterTable: add Meta WABA ID for template fetching
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "meta_waba_id" TEXT;
