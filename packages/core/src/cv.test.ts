import { describe, expect, it } from 'vitest';
import {
  contactLine, cvFileName, formatYearRange, orderEducation, orderExperience,
  renderCvHtml, renderCvWordHtml, type CvData, type CvExperience,
} from './cv';

const cv = (over: Partial<CvData> = {}): CvData => ({
  fullName: 'Grace Wanjiru',
  headline: 'Mathematics & Physics teacher',
  summary: null, email: null, phone: null, location: null,
  tscNumber: null, subjects: [], education: [], experience: [], referees: [],
  ...over,
});

const role = (over: Partial<CvExperience> = {}): CvExperience => ({
  organisation: 'Greenfield Academy', role: 'Mathematics Teacher',
  startYear: 2019, endYear: 2022, isCurrent: false, description: null, ...over,
});

describe('formatYearRange', () => {
  it('shows a span', () => expect(formatYearRange(2019, 2022)).toBe('2019 – 2022'));
  it('collapses a single year rather than printing "2021 – 2021"', () =>
    expect(formatYearRange(2021, 2021)).toBe('2021'));
  it('says Present for a current role', () =>
    expect(formatYearRange(2022, null, true)).toBe('2022 – Present'));
  it('never prints an end year for a current role', () =>
    // The schema forbids the combination; the renderer must not reintroduce it.
    expect(formatYearRange(2019, 2022, true)).toBe('2019 – Present'));
  it('is empty when nothing is known, rather than printing a stray dash', () =>
    expect(formatYearRange(null, null)).toBe(''));
});

describe('ordering', () => {
  it('puts the current role first even though it has no end year', () => {
    const ordered = orderExperience([
      role({ role: 'Old', endYear: 2022 }),
      role({ role: 'Now', startYear: 2023, endYear: null, isCurrent: true }),
    ]);
    expect(ordered.map((e) => e.role)).toEqual(['Now', 'Old']);
  });

  it('is reverse chronological otherwise', () => {
    const ordered = orderExperience([
      role({ role: 'First', endYear: 2015 }),
      role({ role: 'Second', endYear: 2020 }),
    ]);
    expect(ordered.map((e) => e.role)).toEqual(['Second', 'First']);
  });

  it('does not mutate the input', () => {
    const input = [role({ role: 'A', endYear: 2015 }), role({ role: 'B', endYear: 2020 })];
    orderExperience(input);
    expect(input.map((e) => e.role)).toEqual(['A', 'B']);
  });

  it('orders education newest first', () => {
    const ordered = orderEducation([
      { institution: 'X', qualification: 'KCSE', startYear: 2008, endYear: 2011, grade: null },
      { institution: 'Y', qualification: 'BEd', startYear: 2012, endYear: 2016, grade: null },
    ]);
    expect(ordered[0]?.qualification).toBe('BEd');
  });
});

describe('contactLine', () => {
  it('drops missing parts instead of leaving separators', () => {
    expect(contactLine(cv({ phone: '+254712345678', email: null, location: 'Nairobi' })))
      .toBe('+254712345678  ·  Nairobi');
  });
  it('is empty when nothing is set', () => expect(contactLine(cv())).toBe(''));
});

describe('renderCvHtml', () => {
  it('omits a section entirely rather than printing an empty heading', () => {
    const html = renderCvHtml(cv());
    expect(html).not.toContain('Referees');
    expect(html).not.toContain('Experience');
    expect(html).not.toContain('Profile');
  });

  it('includes a section once it has content', () => {
    expect(renderCvHtml(cv({ experience: [role()] }))).toContain('Experience');
  });

  it('escapes what a teacher typed', () => {
    // "Grade < C" must not truncate the document.
    const html = renderCvHtml(cv({ summary: 'Grade < C & "improving"' }));
    expect(html).toContain('Grade &lt; C &amp; &quot;improving&quot;');
    expect(html).not.toContain('Grade < C &');
  });

  it('renders every template without throwing', () => {
    const full = cv({
      summary: 'Ten years teaching.', email: 'g@example.com', phone: '+254712345678',
      location: 'Nairobi', tscNumber: '778211', subjects: ['Mathematics', 'Physics'],
      experience: [role({ isCurrent: true, endYear: null })],
      education: [{ institution: 'UoN', qualification: 'BEd', startYear: 2012, endYear: 2016, grade: 'Second Upper' }],
      referees: [{ name: 'Jane Doe', title: 'Head', organisation: 'Greenfield', phone: '+254700000000', email: null }],
    });
    for (const t of ['classic', 'modern', 'compact'] as const) {
      const html = renderCvHtml(full, t);
      expect(html).toContain('Grace Wanjiru');
      expect(html).toContain('TSC No. 778211');
      expect(html).toContain('Present');
    }
  });

  it('keeps an entry from splitting across a page', () => {
    expect(renderCvHtml(cv({ experience: [role()] }))).toContain('page-break-inside: avoid');
  });
});

describe('renderCvWordHtml', () => {
  it('adds the namespaces Word needs, keeping the same body', () => {
    const word = renderCvWordHtml(cv({ experience: [role()] }));
    expect(word).toContain('urn:schemas-microsoft-com:office:word');
    expect(word).toContain('Mathematics Teacher');
  });
});

describe('cvFileName', () => {
  it('slugs a name', () => expect(cvFileName('Grace Wanjiru', 'pdf')).toBe('grace-wanjiru-cv.pdf'));
  it('survives punctuation and spacing', () =>
    expect(cvFileName("  O'Brien   Ka-mau ", 'doc')).toBe('o-brien-ka-mau-cv.doc'));
  it('falls back when a name has nothing usable', () =>
    expect(cvFileName('•••', 'pdf')).toBe('cv.pdf'));
});
