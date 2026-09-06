/**
 * Kenyan mobile numbers to E.164.
 *
 * Supabase keys the auth user on the phone string, so "0712345678" and
 * "+254712345678" MUST normalise to one value — otherwise the same teacher
 * signing in two different ways gets two accounts, two profiles and two sets of
 * applications. Everything stored or sent to the API goes through here.
 */

export type PhoneResult =
  | { readonly ok: true; readonly e164: string }
  | { readonly ok: false; readonly reason: string };

/**
 * Kenyan mobile subscriber numbers are nine digits after the country code and
 * begin with 7 (Safaricom, Airtel, Telkom) or 1 (the newer 011x range).
 */
const SUBSCRIBER = /^[71]\d{8}$/;

const COUNTRY_CODE = '254';

/** Strip spaces, dashes, dots, brackets and a leading plus. */
const digitsOnly = (input: string): string => input.replace(/[\s\-().+]/g, '');

/**
 * Accepts the forms a Kenyan teacher will actually type:
 *   0712 345 678 · 0712345678 · +254712345678 · 254712345678 · 712345678
 */
export function toE164Kenya(input: string): PhoneResult {
  const raw = digitsOnly(input);

  if (raw === '') return { ok: false, reason: 'Enter your phone number' };
  if (/\D/.test(raw)) return { ok: false, reason: 'Use digits only' };

  let subscriber: string;
  if (raw.startsWith(COUNTRY_CODE) && raw.length === COUNTRY_CODE.length + 9) {
    subscriber = raw.slice(COUNTRY_CODE.length);
  } else if (raw.startsWith('0') && raw.length === 10) {
    subscriber = raw.slice(1);
  } else if (raw.length === 9) {
    subscriber = raw;
  } else {
    return { ok: false, reason: 'That does not look like a Kenyan mobile number' };
  }

  if (!SUBSCRIBER.test(subscriber)) {
    return { ok: false, reason: 'Kenyan mobile numbers start 07 or 01' };
  }

  return { ok: true, e164: `+${COUNTRY_CODE}${subscriber}` };
}

/**
 * Display form: +254 712 345 678. Used on the verify screen so the teacher can
 * check we are texting the right number before they wait for it.
 */
export function formatPhoneForDisplay(e164: string): string {
  const match = /^\+254(\d{3})(\d{3})(\d{3})$/.exec(e164);
  return match === null ? e164 : `+254 ${match[1]} ${match[2]} ${match[3]}`;
}

/** Africa's Talking wants a leading plus, same as E.164. */
export const toAfricasTalkingRecipient = (e164: string): string => e164;
