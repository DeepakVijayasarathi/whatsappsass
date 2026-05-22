-- AlterTable: Contact add leadStatus
ALTER TABLE "contacts" ADD COLUMN "lead_status" TEXT NOT NULL DEFAULT 'new';

-- AlterTable: InboundMessage add campaignId
ALTER TABLE "inbound_messages" ADD COLUMN "campaign_id" TEXT;
CREATE INDEX "inbound_messages_campaign_id_idx" ON "inbound_messages"("campaign_id");

-- CreateTable: contact_notes
CREATE TABLE "contact_notes" (
    "id"           TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "contact_id"   TEXT NOT NULL,
    "user_id"      TEXT,
    "user_email"   TEXT,
    "body"         TEXT NOT NULL,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contact_notes_contact_id_idx" ON "contact_notes"("contact_id");

ALTER TABLE "contact_notes" ADD CONSTRAINT "contact_notes_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contact_notes" ADD CONSTRAINT "contact_notes_contact_id_fkey"
    FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
