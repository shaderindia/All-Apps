// ============================================================
// Supabase Edge Function: send-otp
// Sends OTP via Twilio SMS API
// 
// Deploy: supabase functions deploy send-otp --project-ref qwuozqwaakqoopswwpti
// Set secrets:
//   supabase secrets set TWILIO_ACCOUNT_SID=your_account_sid
//   supabase secrets set TWILIO_AUTH_TOKEN=your_auth_token
//   supabase secrets set TWILIO_PHONE_NUMBER=your_twilio_number
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
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

    // Send OTP via Twilio SMS API
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
    const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER')

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
    const credentials = btoa(`${accountSid}:${authToken}`)

    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: phone,
        From: fromNumber,
        Body: `Your BER OF CHAT verification code is: ${otp}. Valid for 5 minutes. Do not share this code.`
      }).toString()
    })

    const twilioResult = await twilioResponse.json()
    console.log('[Twilio] Status:', twilioResult.status, 'SID:', twilioResult.sid)

    if (twilioResult.error_code) {
      console.error('[Twilio] Error:', twilioResult.message)
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'SMS delivery failed: ' + twilioResult.message 
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

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
