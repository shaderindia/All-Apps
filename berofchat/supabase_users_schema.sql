-- ============================================================
-- BER OF CHAT: User Accounts + OTP Sessions
-- Run this in your Supabase SQL Editor
-- ============================================================

-- User accounts table
CREATE TABLE IF NOT EXISTS ber_users (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  phone         TEXT UNIQUE NOT NULL,
  display_name  TEXT NOT NULL DEFAULT 'User',
  password_hash TEXT NOT NULL,
  verified      BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_login    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ber_users_phone ON ber_users (phone);

-- OTP sessions (temporary, auto-expire)
CREATE TABLE IF NOT EXISTS otp_sessions (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  phone      TEXT NOT NULL,
  otp_code   TEXT NOT NULL,
  purpose    TEXT NOT NULL CHECK (purpose IN ('signup', 'login')),
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_sessions_phone ON otp_sessions (phone, used, expires_at);

-- RLS Policies
ALTER TABLE ber_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_sessions ENABLE ROW LEVEL SECURITY;

-- Allow anon to call RPC functions only (no direct table access)
CREATE POLICY "No direct access to ber_users" ON ber_users FOR ALL TO anon USING (false);
CREATE POLICY "No direct access to otp_sessions" ON otp_sessions FOR ALL TO anon USING (false);

-- ============================================================
-- RPC: Send OTP (generates OTP, stores in DB, returns it for Edge Function)
-- ============================================================
CREATE OR REPLACE FUNCTION request_otp(p_phone TEXT, p_purpose TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_otp TEXT;
  v_exists BOOLEAN;
BEGIN
  -- Validate purpose
  IF p_purpose NOT IN ('signup', 'login') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid purpose');
  END IF;

  -- Check if user exists
  SELECT EXISTS(SELECT 1 FROM ber_users WHERE phone = p_phone) INTO v_exists;
  
  IF p_purpose = 'signup' AND v_exists THEN
    RETURN json_build_object('success', false, 'error', 'Phone number already registered. Please login.');
  END IF;
  
  IF p_purpose = 'login' AND NOT v_exists THEN
    RETURN json_build_object('success', false, 'error', 'Phone number not found. Please sign up first.');
  END IF;

  -- Generate 6-digit OTP
  v_otp := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');

  -- Invalidate old OTPs for this phone
  UPDATE otp_sessions SET used = true WHERE phone = p_phone AND used = false;

  -- Insert new OTP (expires in 5 minutes)
  INSERT INTO otp_sessions (phone, otp_code, purpose, expires_at)
  VALUES (p_phone, v_otp, p_purpose, NOW() + INTERVAL '5 minutes');

  RETURN json_build_object('success', true, 'otp', v_otp);
END;
$$;

-- ============================================================
-- RPC: Verify OTP
-- ============================================================
CREATE OR REPLACE FUNCTION verify_otp(p_phone TEXT, p_otp TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session RECORD;
BEGIN
  -- Find valid, unused OTP
  SELECT * INTO v_session FROM otp_sessions
  WHERE phone = p_phone AND otp_code = p_otp AND used = false AND expires_at > NOW()
  ORDER BY created_at DESC LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or expired OTP');
  END IF;

  -- Mark as used
  UPDATE otp_sessions SET used = true WHERE id = v_session.id;

  -- Mark user as verified if signup
  UPDATE ber_users SET verified = true WHERE phone = p_phone;

  RETURN json_build_object('success', true, 'purpose', v_session.purpose);
END;
$$;

-- ============================================================
-- RPC: Sign Up (after OTP verified)
-- ============================================================
CREATE OR REPLACE FUNCTION signup_user(p_phone TEXT, p_password TEXT, p_name TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM ber_users WHERE phone = p_phone) INTO v_exists;
  
  IF v_exists THEN
    RETURN json_build_object('success', false, 'error', 'Phone already registered');
  END IF;

  INSERT INTO ber_users (phone, display_name, password_hash, verified)
  VALUES (p_phone, p_name, crypt(p_password, gen_salt('bf')), true);

  RETURN json_build_object('success', true, 'message', 'Account created successfully');
END;
$$;

-- ============================================================
-- RPC: Login
-- ============================================================
CREATE OR REPLACE FUNCTION login_user(p_phone TEXT, p_password TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user RECORD;
BEGIN
  SELECT * INTO v_user FROM ber_users
  WHERE phone = p_phone AND verified = true;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Account not found or not verified');
  END IF;

  IF v_user.password_hash != crypt(p_password, v_user.password_hash) THEN
    RETURN json_build_object('success', false, 'error', 'Incorrect password');
  END IF;

  -- Update last login
  UPDATE ber_users SET last_login = NOW() WHERE id = v_user.id;

  RETURN json_build_object('success', true, 'user', json_build_object(
    'id', v_user.id,
    'phone', v_user.phone,
    'display_name', v_user.display_name
  ));
END;
$$;

-- ============================================================
-- Enable pgcrypto for password hashing
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Auto-cleanup expired OTP sessions (older than 1 hour)
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE deleted_count INTEGER;
BEGIN
  DELETE FROM otp_sessions WHERE expires_at < NOW() - INTERVAL '1 hour';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
