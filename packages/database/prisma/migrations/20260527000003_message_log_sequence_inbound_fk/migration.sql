-- Add sequence_id to message_logs so sequence-sent messages can be identified in analytics/timeline
ALTER TABLE "message_logs" ADD COLUMN IF NOT EXISTS "sequence_id" TEXT;

CREATE INDEX IF NOT EXISTS "message_logs_sequence_id_idx" ON "message_logs"("sequence_id");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'message_logs_sequence_id_fkey') THEN
    ALTER TABLE "message_logs" ADD CONSTRAINT "message_logs_sequence_id_fkey"
      FOREIGN KEY ("sequence_id") REFERENCES "campaign_sequences"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Add FK for inbound_messages.campaign_id (was unguarded — dangling refs on campaign delete)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inbound_messages_campaign_id_fkey') THEN
    ALTER TABLE "inbound_messages" ADD CONSTRAINT "inbound_messages_campaign_id_fkey"
      FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
