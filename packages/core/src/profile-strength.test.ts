import { describe, expect, it } from 'vitest';
import { profileStrength, type CvCompleteness } from './profile-strength';
import { teacher } from './fixtures';

const emptyCv: CvCompleteness = {
  hasSummary: false, experienceCount: 0, educationCount: 0, refereeCount: 0,
};
const fullCv: CvCompleteness = {
  hasSummary: true, experienceCount: 2, educationCount: 1, refereeCount: 1,
};

describe('profileStrength', () => {
  it('reaches 100 only when nothing is left', () => {
    const t = teacher({ headline: 'Mathematics teacher', curricula: ['cbc'] });
    const s = profileStrength(t, fullCv);
    expect(s.percent).toBe(100);
    expect(s.missing).toEqual([]);
  });

  it('is never zero for a teacher who finished onboarding', () => {
    // Subjects are mandatory to sign up, so the floor is above nothing —
    // showing 0% to someone who just completed a form would read as a failure.
    const s = profileStrength(teacher({ tscNumber: undefined, headline: undefined, curricula: [] }), emptyCv);
    expect(s.percent).toBeGreaterThan(0);
  });

  it('puts the TSC number first, because it is a hard gate in the matcher', () => {
    const s = profileStrength(
      teacher({ tscNumber: undefined, headline: undefined, curricula: [] }),
      emptyCv,
    );
    expect(s.missing[0]?.label).toBe('Add your TSC number');
  });

  it('orders the rest by weight, heaviest first', () => {
    const s = profileStrength(teacher({ headline: undefined, curricula: [] }), emptyCv);
    const weights = s.missing.map((m) => m.weight);
    expect([...weights].sort((a, b) => b - a)).toEqual(weights);
  });

  it('counts a CV that is filled in', () => {
    const bare = profileStrength(teacher(), emptyCv).percent;
    const full = profileStrength(teacher(), fullCv).percent;
    expect(full).toBeGreaterThan(bare);
  });

  it('treats a whitespace headline as missing', () => {
    const s = profileStrength(teacher({ headline: '   ' }), fullCv);
    expect(s.missing.some((m) => m.label === 'Add a headline')).toBe(true);
  });
});
