// Send SMS auth hook — delivers Supabase OTP codes via Africa's Talking.
//
// Supabase has no native Africa's Talking provider, and the Twilio/Vonage
// options bill international rates to Kenyan numbers. This hook is the
// supported way in: Supabase POSTs { user: { phone }, sms: { otp } } and
// expects HTTP 200 with an empty JSON object.
//
// Requests are signed with Standard Webhooks. Verifying is not optional — the
// endpoint is public, and without it anyone could POST here and burn SMS
// credit, or probe which numbers have accounts.
//
// Required secrets:
//   SEND_SMS_HOOK_SECRET  from Supabase (format: v1,whsec_<base64>)
//   AT_API_KEY            Africa's Talking API key
//   AT_USERNAME           Africa's Talking username ('sandbox' while testing)
//   AT_SENDER_ID          optional; a registered alphanumeric sender or short code

import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';

interface SendSmsPayload {
  readonly user: { readonly phone: string };
  readonly sms: { readonly otp: string };
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (value === undefined || value === '') throw new Error(`Missing ${name}`);
  return value;
}

async function sendViaAfricasTalking(to: string, message: string): Promise<void> {
  const username = requireEnv('AT_USERNAME');
  const apiKey = requireEnv('AT_API_KEY');
  const senderId = Deno.env.get('AT_SENDER_ID');

  // Sandbox and live are different hosts; using the wrong one silently fails
  // to deliver rather than erroring.
  const host = username === 'sandbox'
    ? 'https://api.sandbox.africastalking.com'
    : 'https://api.africastalking.com';

  const body = new URLSearchParams({ username, to, message });
  if (senderId !== undefined && senderId !== '') body.set('from', senderId);

  const response = await fetch(`${host}/version1/messaging`, {
    method: 'POST',
    headers: {
      apiKey,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Africa's Talking ${response.status}: ${text.slice(0, 200)}`);
  }

  // A 200 does not mean delivery: per-recipient status lives in the body.
  // "Success" is the only status that means the message actually went out.
  if (!text.includes('"status":"Success"') && !text.includes('Success')) {
    throw new Error(`Africa's Talking rejected the recipient: ${text.slice(0, 200)}`);
  }
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const raw = await request.text();

  let payload: SendSmsPayload;
  try {
    const secret = requireEnv('SEND_SMS_HOOK_SECRET').replace('v1,whsec_', '');
    const webhook = new Webhook(secret);
    payload = webhook.verify(raw, Object.fromEntries(request.headers)) as SendSmsPayload;
  } catch (cause) {
    // Do not echo the reason: this endpoint is public.
    console.error('signature verification failed', cause);
    return json({ error: 'invalid signature' }, 401);
  }

  const phone = payload.user?.phone;
  const otp = payload.sms?.otp;
  if (typeof phone !== 'string' || typeof otp !== 'string') {
    return json({ error: 'malformed payload' }, 400);
  }

  try {
    await sendViaAfricasTalking(
      phone,
      `${otp} is your Mwalimu Kazi verification code. It expires in 10 minutes. Do not share it with anyone.`,
    );
  } catch (cause) {
    // Logged for the dashboard; the caller only learns that delivery failed, so
    // a failure cannot be used to enumerate which numbers exist.
    console.error('sms delivery failed', cause);
    return json({ error: 'delivery failed' }, 500);
  }

  return json({});
});
