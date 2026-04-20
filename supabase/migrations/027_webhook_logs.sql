-- ============================================================
-- MIGRATION 027: Log de webhooks (debug Vapi)
-- ============================================================

CREATE TABLE IF NOT EXISTS webhook_logs_vapi (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  vapi_call_id text,
  event_type text,
  payload_preview text,
  received_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_vapi_received ON webhook_logs_vapi(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_vapi_call ON webhook_logs_vapi(vapi_call_id);
