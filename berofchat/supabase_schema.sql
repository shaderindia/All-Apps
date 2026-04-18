-- ============================================================
-- BER OF CHAT: Supabase Schema for Legal Traceability
-- IT Rules 2021 Compliance (First Originator Tracing)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Table: legal_traceability
-- Stores ONLY message hashes and room access logs.
-- NO raw message text. NO IP addresses. NO personal data.
-- ============================================================
CREATE TABLE IF NOT EXISTS legal_traceability (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_type    TEXT NOT NULL CHECK (event_type IN ('message_hash', 'room_join', 'room_leave')),
  sender_id     TEXT NOT NULL,           -- PeerJS peer ID (pseudonymous)
  room_code     TEXT NOT NULL,           -- Room code
  message_hash  TEXT,                    -- SHA-256 hash (only for message_hash events)
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for auto-purge queries (filter by date)
CREATE INDEX idx_traceability_created_at ON legal_traceability (created_at);

-- Index for legal lookups (filter by room)
CREATE INDEX idx_traceability_room ON legal_traceability (room_code, created_at);

-- ============================================================
-- Row Level Security (RLS)
-- Only allow INSERT from anonymous users (the chat app).
-- SELECT/DELETE restricted to service_role (admin/cron only).
-- ============================================================
ALTER TABLE legal_traceability ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (the browser app uses anon key)
CREATE POLICY "Allow anonymous inserts"
  ON legal_traceability
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Block anonymous reads (privacy: users cannot query the table)
CREATE POLICY "Block anonymous reads"
  ON legal_traceability
  FOR SELECT
  TO anon
  USING (false);

-- ============================================================
-- Function: purge_old_traceability
-- Deletes all rows older than 180 days.
-- Called by pg_cron or Edge Function.
-- ============================================================
CREATE OR REPLACE FUNCTION purge_old_traceability()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM legal_traceability
  WHERE created_at < NOW() - INTERVAL '180 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RAISE NOTICE 'Purged % traceability records older than 180 days', deleted_count;
  RETURN deleted_count;
END;
$$;

-- ============================================================
-- OPTIONAL: If your Supabase plan supports pg_cron,
-- schedule auto-purge to run daily at 3:00 AM UTC.
-- Uncomment the lines below after enabling pg_cron.
-- ============================================================
-- SELECT cron.schedule(
--   'purge-traceability-180d',
--   '0 3 * * *',
--   $$ SELECT purge_old_traceability(); $$
-- );
