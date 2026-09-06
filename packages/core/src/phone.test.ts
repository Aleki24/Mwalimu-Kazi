import { describe, expect, it } from 'vitest';
import { formatPhoneForDisplay, toE164Kenya } from './phone';

describe('toE164Kenya', () => {
  it('normalises every form a teacher might type to one value', () => {
    // This is the whole point: differing input must not create two accounts.
    const forms = [
      '0712345678',
      '0712 345 678',
      '0712-345-678',
      '+254712345678',
      '+254 712 345 678',
      '254712345678',
      '712345678',
    ];
    for (const form of forms) {
      const result = toE164Kenya(form);
      expect(result, form).toEqual({ ok: true, e164: '+254712345678' });
    }
  });

  it('accepts the newer 01x range', () => {
    expect(toE164Kenya('0110123456')).toEqual({ ok: true, e164: '+254110123456' });
  });

  it('rejects an empty entry with something actionable', () => {
    expect(toE164Kenya('   ')).toEqual({ ok: false, reason: 'Enter your phone number' });
  });

  it('rejects a landline or wrong-prefix number', () => {
    expect(toE164Kenya('0202345678').ok).toBe(false);
    expect(toE164Kenya('0412345678').ok).toBe(false);
  });

  it('rejects wrong lengths', () => {
    expect(toE164Kenya('071234567').ok).toBe(false);     // 9 digits, leading 0
    expect(toE164Kenya('07123456789').ok).toBe(false);   // one too many
    expect(toE164Kenya('+2547123456789').ok).toBe(false);
  });

  it('rejects letters', () => {
    expect(toE164Kenya('07ABC45678').ok).toBe(false);
  });
});

describe('formatPhoneForDisplay', () => {
  it('groups an E.164 number for reading back', () => {
    expect(formatPhoneForDisplay('+254712345678')).toBe('+254 712 345 678');
  });

  it('passes anything unexpected through untouched', () => {
    expect(formatPhoneForDisplay('+1555000111')).toBe('+1555000111');
  });
});
