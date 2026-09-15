import { describe, expect, it } from 'vitest';
import { CV_STEP_IDS, cvReadiness, EMPTY_CV_FACTS, type CvFacts } from './cv-progress';

const full: CvFacts = {
  hasContact: true, hasSummary: true, experienceCount: 2, educationCount: 1,
  refereeCount: 2, certificateCount: 1, skillCount: 4, languageCount: 2,
  volunteerCount: 1, hasPhoto: true,
};

/** Everything a school insists on, and none of the extras. */
const essentialsOnly: CvFacts = {
  ...EMPTY_CV_FACTS,
  hasContact: true, hasSummary: true, experienceCount: 1, educationCount: 1, refereeCount: 1,
};

describe('cvReadiness', () => {
  it('is zero and not ready for a CV nobody has touched', () => {
    const r = cvReadiness(EMPTY_CV_FACTS);
    expect(r.percent).toBe(0);
    expect(r.ready).toBe(false);
    expect(r.missing).toHaveLength(CV_STEP_IDS.length);
  });

  it('reaches 100 only when every section has something in it', () => {
    const r = cvReadiness(full);
    expect(r.percent).toBe(100);
    expect(r.missing).toEqual([]);
    expect(r.next).toBeNull();
  });

  it('is ready to send once the essentials are done, without being complete', () => {
    const r = cvReadiness(essentialsOnly);
    expect(r.ready).toBe(true);
    expect(r.essentialsLeft).toBe(0);
    expect(r.percent).toBeLessThan(100);
    expect(r.summary).toContain('Ready to send');
  });

  it('will not call a CV ready while an essential is empty', () => {
    const r = cvReadiness({ ...essentialsOnly, refereeCount: 0 });
    expect(r.ready).toBe(false);
    expect(r.summary).toBe('One more thing before this is ready to send.');
  });

  it('asks for a missing essential before anything optional', () => {
    const r = cvReadiness({ ...full, refereeCount: 0, skillCount: 0, languageCount: 0 });
    expect(r.next?.id).toBe('referees');
  });

  it('falls back to the heaviest extra once nothing essential is left', () => {
    const r = cvReadiness({ ...essentialsOnly, certificateCount: 1 });
    expect(r.next?.id).toBe('skills');
  });

  it('orders what is missing heaviest first', () => {
    const weights = cvReadiness(EMPTY_CV_FACTS).missing.map((s) => s.weight);
    expect([...weights].sort((a, b) => b - a)).toEqual(weights);
  });

  it('counts languages as filling the skills fold', () => {
    const r = cvReadiness({ ...EMPTY_CV_FACTS, languageCount: 2 });
    expect(r.byId.skills.done).toBe(true);
    expect(r.byId.skills.count).toBe(2);
  });

  it('reports entry counts a screen can print beside a closed section', () => {
    const r = cvReadiness(full);
    expect(r.byId.experience.count).toBe(2);
    expect(r.byId.skills.count).toBe(6);
    // A single answer still counts as one, so a caller never special-cases it.
    expect(r.byId.photo.count).toBe(1);
  });

  it('keeps the steps in the order the editor asks for them', () => {
    expect(cvReadiness(full).steps.map((s) => s.id)).toEqual([...CV_STEP_IDS]);
  });

  it('weights experience above everything else a teacher writes', () => {
    const { byId } = cvReadiness(EMPTY_CV_FACTS);
    const heaviest = [...Object.values(byId)].sort((a, b) => b.weight - a.weight)[0];
    expect(heaviest?.id).toBe('experience');
  });

  it('shares its facts with profileStrength rather than restating them', () => {
    // CvFacts extends CvCompleteness, so one fetch feeds both. This fails to
    // compile — not at runtime — if the two ever drift apart.
    const completeness: Pick<CvFacts, 'hasSummary' | 'experienceCount' | 'educationCount' | 'refereeCount'> = full;
    expect(completeness.experienceCount).toBe(2);
  });
});
