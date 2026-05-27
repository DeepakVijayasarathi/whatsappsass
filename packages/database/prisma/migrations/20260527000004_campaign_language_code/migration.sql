-- Add language_code column to campaigns table
-- Idempotent: safe to run multiple times
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "language_code" TEXT NOT NULL DEFAULT 'en_US';
