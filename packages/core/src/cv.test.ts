import { describe, expect, it } from 'vitest';
import {
  certificateLine, certificateWhen, contactLine, cvFileName, describeBlocks,
  formatYearRange, orderEducation, orderExperience,
  renderCvHtml, renderCvPreviewHtml, renderCvWordHtml, type CvData, type CvExperience,
} from './cv';

const cv = (over: Partial<CvData> = {}): CvData => ({
  fullName: 'Grace Wanjiru',
  headline: 'Mathematics & Physics teacher',
  summary: null, email: null, phone: null, location: null,
  tscNumber: null, subjects: [], education: [], experience: [], referees: [],
  photoDataUri: null, dateOfBirth: null, gender: null, nationality: null,
  address: null, postCode: null, skills: [], languages: [], hobbies: [],
  responsibilities: [], certificates: [], volunteer: [],
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

describe('renderCvPreviewHtml', () => {
  const filled = cv({ summary: 'Ten years teaching.', experience: [role()] });

  it('scales the page rather than reflowing it into a column', () => {
    // Reflowed text would break lines where the PDF will not, which is the
    // one thing a preview must never do.
    expect(renderCvPreviewHtml(filled)).toContain('width=794, initial-scale=1');
  });

  it('shows exactly what the export will show', () => {
    const preview = renderCvPreviewHtml(filled, 'modern');
    const exported = renderCvHtml(filled, 'modern');
    // Every content node in the export survives into the preview; the preview
    // only adds a viewport and a page frame.
    const text = (html: string) => html.replace(/<style>[\s\S]*?<\/style>/g, '')
      .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    expect(text(preview)).toBe(text(exported));
  });
});

describe('describeBlocks', () => {
  /**
   * A teacher types a heading and then a run of dashes, because that is how
   * everyone writes a job description. Printing it verbatim gave a wall of
   * hyphens.
   */
  it('turns dashed lines into a list under the line above them', () => {
    expect(describeBlocks([
      'Key Responsibilities',
      '- Planned and delivered lessons',
      '- Marked coursework',
    ].join('\n'))).toEqual([
      { kind: 'heading', text: 'Key Responsibilities' },
      { kind: 'list', items: ['Planned and delivered lessons', 'Marked coursework'] },
    ]);
  });

  it('leaves prose as prose', () => {
    expect(describeBlocks('I taught Form 3 mathematics for four years.'))
      .toEqual([{ kind: 'paragraph', text: 'I taught Form 3 mathematics for four years.' }]);
  });

  it('only calls a line a heading when a bullet actually follows it', () => {
    // Two plain lines in a row are two paragraphs. Bolding the first because
    // it happens to be short would reformat a teacher's writing at random.
    expect(describeBlocks('One line.\nAnother line.').map((b) => b.kind))
      .toEqual(['paragraph', 'paragraph']);
  });

  it('accepts the three marks people actually type', () => {
    const blocks = describeBlocks('- one\n* two\n• three');
    expect(blocks).toEqual([{ kind: 'list', items: ['one', 'two', 'three'] }]);
  });

  it('drops blank lines rather than printing empty bullets', () => {
    expect(describeBlocks('\n\n- one\n\n')).toEqual([{ kind: 'list', items: ['one'] }]);
  });

  it('handles a list that runs to the end without losing the last item', () => {
    const blocks = describeBlocks('Intro:\n- a\n- b');
    expect(blocks[blocks.length - 1]).toEqual({ kind: 'list', items: ['a', 'b'] });
  });
});

describe('certificates', () => {
  const cert = (over = {}) => ({
    title: 'Certificate in computer packages', description: null,
    year: 2016, isOngoing: false, ...over,
  });

  it('prints the year', () => expect(certificateWhen(cert())).toBe('2016'));
  it('says so when it is still being taken', () =>
    expect(certificateWhen(cert({ year: null, isOngoing: true }))).toBe('In progress'));
  it('says nothing rather than printing an empty bracket', () =>
    expect(certificateWhen(cert({ year: null }))).toBe(''));
  it('joins the parts it has for the one-line templates', () =>
    expect(certificateLine(cert({ description: 'Webuye' })))
      .toBe('Certificate in computer packages — Webuye — (2016)'));
  it('leaves out the parts it does not have', () =>
    expect(certificateLine(cert({ year: null }))).toBe('Certificate in computer packages'));
});

describe('the portrait template', () => {
  const full = cv({
    summary: 'To utilise the knowledge acquired in class and in the field.',
    email: 'grace@example.com',
    phone: '0712345678',
    location: 'Wodanga',
    postCode: '50311',
    address: 'P.O Box 132-50311',
    dateOfBirth: '23 December 1996',
    gender: 'Female',
    nationality: 'Kenyan',
    skills: ['Computer packages', 'Leadership'],
    languages: ['English', 'Kiswahili'],
    hobbies: ['Reading novels'],
    responsibilities: ['Class teacher of Form 4G'],
    certificates: [{ title: 'Certificate in computer packages', description: 'Webuye', year: 2016, isOngoing: false }],
    volunteer: [role({ role: 'Receptionist', organisation: 'Makori Nyangau & Co', startYear: 2016, endYear: 2016 })],
    education: [{ institution: 'Egerton University', qualification: 'B.Ed Arts', startYear: 2016, endYear: 2022, grade: 'Second Class Upper' }],
    experience: [role({ description: 'Key Responsibilities\n- Planned lessons' })],
    referees: [{ name: 'Mr. Alexis Omenda', title: 'Principal', organisation: 'St Georges Sianda', phone: '0711 760811', email: null }],
    photoDataUri: 'data:image/jpeg;base64,AAAA',
  });

  it('puts every section on the page', () => {
    const html = renderCvHtml(full, 'portrait');
    for (const heading of [
      'Personal details', 'Skills', 'Languages', 'Hobbies', 'Volunteer work',
      'Responsibilities', 'Certificates', 'Profile', 'Education', 'Experience', 'Referees',
    ]) {
      expect(html, `missing the ${heading} section`).toContain(`>${heading}</h2>`);
    }
  });

  it('carries the photograph inside the document rather than linking to it', () => {
    expect(renderCvHtml(full, 'portrait')).toContain('src="data:image/jpeg;base64,AAAA"');
  });

  /**
   * The sidebar is a float and the blue edge is a body background, both so the
   * document survives a page break. A flex row fragments unpredictably, and an
   * element painted as the edge stops at the end of page one.
   */
  it('lays the sidebar out as a float, not as flex', () => {
    const html = renderCvHtml(full, 'portrait');
    expect(html).toContain('.side { float: left;');
    expect(html).toMatch(/body \{[^}]*background: linear-gradient/);
  });

  it('breaks a long email at the @ and nowhere else', () => {
    const html = renderCvHtml(full, 'portrait');
    expect(html).toContain('grace@<wbr>example.com');
  });

  it('prints the address as an employer expects to read it', () => {
    expect(renderCvHtml(full, 'portrait')).toContain('P.O Box 132-50311<br>50311 Wodanga');
  });

  it('leaves out a section nobody filled in', () => {
    const html = renderCvHtml(cv(), 'portrait');
    expect(html).not.toContain('>Hobbies</h2>');
    expect(html).not.toContain('>Referees</h2>');
    expect(html).not.toContain('<img');
  });

  it('escapes what a teacher typed', () => {
    const html = renderCvHtml(cv({ summary: 'Grade < C & "fine"' }), 'portrait');
    expect(html).toContain('Grade &lt; C &amp; &quot;fine&quot;');
    expect(html).not.toContain('Grade < C');
  });

  it('is the default, so the preview and the export agree without being asked', () => {
    expect(renderCvHtml(full)).toBe(renderCvHtml(full, 'portrait'));
  });

  it('gives the preview no page padding of its own — the sheet already has it', () => {
    // The plain templates get their margins from @page, which does not apply
    // on screen, so they need it. Adding it here would double the inset and
    // show the teacher a layout the PDF will not have.
    expect(renderCvPreviewHtml(full, 'portrait')).not.toContain('padding: 16mm');
    expect(renderCvPreviewHtml(full, 'classic')).toContain('padding: 16mm');
  });

  it('opens in Word as the same document', () => {
    expect(renderCvWordHtml(full, 'portrait')).toContain('urn:schemas-microsoft-com:office:word');
  });
});
