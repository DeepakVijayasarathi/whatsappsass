-- Add wamid column to message_logs for precise delivery receipt matching
-- wamid = provider-assigned message ID (Meta wamid / MSG91 request_id)
-- Previously delivery receipts matched by (workspaceId, contactId, status='sent')
-- which could incorrectly update all pending logs for a contact.
-- Now we match by wamid first, falling back to most-recent log for legacy rows.

ALTER TABLE "message_logs" ADD COLUMN "wamid" TEXT;

-- Index for fast delivery receipt lookups by provider message ID
CREATE INDEX "message_logs_wamid_idx" ON "message_logs"("wamid");
