// ============================================================
// Supabase Edge Function: send-otp
// Sends OTP via MTALKZ SMS API
// 
// Deploy: supabase functions deploy send-otp
// Set secrets:
//   supabase secrets set MTALKZ_API_KEY=your_key
//   supabase secrets set MTALKZ_SENDER_ID=your_sender_id
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { phone, purpose } = await req.json()

    if (!phone || !purpose) {
      return new Response(JSON.stringify({ success: false, error: 'Phone and purpose required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Initialize Supabase with service role (server-side)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Generate OTP via database function
    const { data: otpResult, error: otpError } = await supabase.rpc('request_otp', {
      p_phone: phone,
      p_purpose: purpose
    })

    if (otpError || !otpResult?.success) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: otpResult?.error || otpError?.message || 'Failed to generate OTP' 
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const otp = otpResult.otp

    // Send OTP via MTALKZ API
    const mtalkzApiKey = Deno.env.get('MTALKZ_API_KEY')
    const mtalkzSenderId = Deno.env.get('MTALKZ_SENDER_ID')

    const mtalkzResponse = await fetch('http://msg.mtalkz.com/V2/http-api-post.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        APIKEY: mtalkzApiKey,
        SENDERID: mtalkzSenderId,
        NUMBER: phone.replace('+', ''),
        MESSAGE: `Your BER OF CHAT verification code is: ${otp}. Valid for 5 minutes. Do not share this code. - SHADER7`,
        FORMAT: 'JSON'
      })
    })

    const mtalkzResult = await mtalkzResponse.text()
    console.log('[MTALKZ] Response:', mtalkzResult)

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'OTP sent successfully' 
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('[send-otp] Error:', err)
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
