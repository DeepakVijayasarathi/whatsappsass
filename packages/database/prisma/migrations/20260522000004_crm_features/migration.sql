-- AlterTable: Contact add leadStatus
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "lead_status" TEXT NOT NULL DEFAULT 'new';

-- AlterTable: InboundMessage add campaignId
ALTER TABLE "inbound_messages" ADD COLUMN IF NOT EXISTS "campaign_id" TEXT;
CREATE INDEX IF NOT EXISTS "inbound_messages_campaign_id_idx" ON "inbound_messages"("campaign_id");

-- CreateTable: contact_notes
CREATE TABLE IF NOT EXISTS "contact_notes" (
    "id"           TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "contact_id"   TEXT NOT NULL,
    "user_id"      TEXT,
    "user_email"   TEXT,
    "body"         TEXT NOT NULL,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "contact_notes_contact_id_idx" ON "contact_notes"("contact_id");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contact_notes_workspace_id_fkey') THEN
    ALTER TABLE "contact_notes" ADD CONSTRAINT "contact_notes_workspace_id_fkey"
      FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contact_notes_contact_id_fkey') THEN
    ALTER TABLE "contact_notes" ADD CONSTRAINT "contact_notes_contact_id_fkey"
      FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
