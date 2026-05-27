CREATE TABLE IF NOT EXISTS "webhook_delivery_logs" (
    "id" TEXT NOT NULL,
    "endpoint_id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "status_code" INTEGER,
    "success" BOOLEAN NOT NULL,
    "duration_ms" INTEGER,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_delivery_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "webhook_delivery_logs_endpoint_id_created_at_idx" ON "webhook_delivery_logs"("endpoint_id", "created_at");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'webhook_delivery_logs_endpoint_id_fkey') THEN
    ALTER TABLE "webhook_delivery_logs" ADD CONSTRAINT "webhook_delivery_logs_endpoint_id_fkey"
      FOREIGN KEY ("endpoint_id") REFERENCES "webhook_endpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
