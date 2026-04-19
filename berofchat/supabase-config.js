// ============================================================
// BER OF CHAT — Supabase Configuration
// Replace the placeholders below with your Supabase credentials.
// ============================================================

const SUPABASE_URL = 'https://qwuozqwaakqoopswwpti.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3dW96cXdhYWtxb29wc3d3cHRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NTc5MjEsImV4cCI6MjA5MjEzMzkyMX0.fZ8i4PcXKGGI3SjPxzTPUE5PTbWlyrYaC6W099M244w';

// Initialize Supabase client (loaded from CDN in index.html)
let supabase = null;

function initSupabase() {
  if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('[Supabase] Client initialized.');
    return true;
  }
  console.warn('[Supabase] Client library not loaded. Traceability logging disabled.');
  return false;
}

// ============================================================
// Traceability Logging (IT Rules 2021)
// Logs message hashes and room events to Supabase.
// Falls back silently if Supabase is not configured.
// ============================================================

async function logTraceEvent(eventType, senderId, roomCode, messageHash = null) {
  if (!supabase) return;
  if (SUPABASE_URL.includes('YOUR_PROJECT_ID')) return;
  if (window._gdprRejected) return; // GDPR: user rejected data processing

  try {
    const { error } = await supabase
      .from('legal_traceability')
      .insert({
        event_type: eventType,
        sender_id: senderId,
        room_code: roomCode,
        message_hash: messageHash
      });

    if (error) {
      console.error('[Traceability] Insert failed:', error.message);
    }
  } catch (err) {
    // Silently fail — chat must never break due to logging
  }
}

async function logMessageHash(senderId, roomCode, plainText) {
  try {
    const msgUint8 = new TextEncoder().encode(plainText);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    await logTraceEvent('message_hash', senderId, roomCode, hash);
  } catch (err) {
    // Silently fail
  }
}

async function logRoomJoin(senderId, roomCode) {
  await logTraceEvent('room_join', senderId, roomCode);
}

async function logRoomLeave(senderId, roomCode) {
  await logTraceEvent('room_leave', senderId, roomCode);
}

// ============================================================
// India SIM-Binding OTP (DoT March 2026 Mandate)
// Uses Supabase Auth Phone OTP when user is in India.
// ============================================================

let otpVerified = false;
let userCountry = null;

async function sendOTP(phoneNumber) {
  if (!supabase) throw new Error('Supabase not initialized');

  const { data, error } = await supabase.auth.signInWithOtp({
    phone: phoneNumber
  });

  if (error) throw error;
  return data;
}

async function verifyOTP(phoneNumber, otpCode) {
  if (!supabase) throw new Error('Supabase not initialized');

  const { data, error } = await supabase.auth.verifyOtp({
    phone: phoneNumber,
    token: otpCode,
    type: 'sms'
  });

  if (error) throw error;
  otpVerified = true;
  return data;
}

// ============================================================
// Auto-Purge Trigger (for Edge Function fallback)
// Can be called from a scheduled HTTPS request.
// ============================================================

async function triggerPurge() {
  if (!supabase) return;
  if (SUPABASE_URL.includes('YOUR_PROJECT_ID')) return;

  try {
    const { data, error } = await supabase.rpc('purge_old_traceability');
    if (error) {
      console.error('[Purge] Failed:', error.message);
    } else {
      console.log('[Purge] Deleted records:', data);
    }
  } catch (err) {
    console.error('[Purge] Error:', err);
  }
}
