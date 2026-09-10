/**
 * CV rendering.
 *
 * Pure functions producing an HTML document. The app turns that into a PDF
 * with expo-print and into a Word-openable file by changing the wrapper, so
 * both formats come from one layout and cannot drift apart.
 *
 * Templates are HTML rather than a native view because a CV is a paged, A4
 * document. React Native has no page model; a browser engine does, and it is
 * already on the device.
 */

export interface CvEducation {
  readonly institution: string;
  readonly qualification: string;
  readonly startYear: number | null;
  readonly endYear: number | null;
  readonly grade: string | null;
}

export interface CvExperience {
  readonly organisation: string;
  readonly role: string;
  readonly startYear: number | null;
  readonly endYear: number | null;
  readonly isCurrent: boolean;
  readonly description: string | null;
}

/** A short course: what it was, where, and when. */
export interface CvCertificate {
  readonly title: string;
  readonly description: string | null;
  readonly year: number | null;
  readonly isOngoing: boolean;
}

export interface CvReferee {
  readonly name: string;
  readonly title: string | null;
  readonly organisation: string | null;
  readonly phone: string | null;
  readonly email: string | null;
}

export interface CvData {
  readonly fullName: string;
  readonly headline: string | null;
  readonly summary: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  /** The city or town. Doubles as the header location on the plain templates. */
  readonly location: string | null;
  readonly tscNumber: string | null;
  readonly subjects: readonly string[];
  readonly education: readonly CvEducation[];
  readonly experience: readonly CvExperience[];
  readonly referees: readonly CvReferee[];

  /**
   * The photograph, already a `data:` URI.
   *
   * Never a URL. The bucket is private, so a link would be a signed URL that
   * expires — and a CV whose photograph turns into a broken image a week after
   * it was sent is worse than one that never had a photograph. Inlining also
   * means the PDF and the Word file carry the picture with them.
   */
  readonly photoDataUri: string | null;
  /** Already formatted for print: the renderer does not know a locale. */
  readonly dateOfBirth: string | null;
  readonly gender: string | null;
  readonly nationality: string | null;
  readonly address: string | null;
  readonly postCode: string | null;
  readonly skills: readonly string[];
  readonly languages: readonly string[];
  readonly hobbies: readonly string[];
  readonly responsibilities: readonly string[];
  readonly certificates: readonly CvCertificate[];
  readonly volunteer: readonly CvExperience[];
}

export const CV_TEMPLATES = {
  portrait: 'Portrait',
  classic: 'Classic',
  modern: 'Modern',
  compact: 'Compact',
} as const;
export type CvTemplate = keyof typeof CV_TEMPLATES;

/** What each template is for, shown next to its name in the picker. */
export const CV_TEMPLATE_HINT: Readonly<Record<CvTemplate, string>> = {
  portrait: 'Two columns with your photograph, and room for everything — languages, hobbies, responsibilities, short courses. What most Kenyan employers expect to receive.',
  classic: 'Plain and scannable. The safe choice for TSC and county applications.',
  modern: 'A ruled header with your details set apart. Good for private schools.',
  compact: 'Tighter spacing to keep a long history on one page.',
};

/**
 * Escape before interpolation. Every field here is typed by a teacher, and a
 * CV containing `<` in "Grade < C" must not silently truncate the document.
 */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Trimmed, or null when there was nothing there. */
function some(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : trimmed;
}

/** "2019 – 2022", "2019 – Present", "2022", or "" when nothing is known. */
export function formatYearRange(
  startYear: number | null,
  endYear: number | null,
  isCurrent = false,
): string {
  if (isCurrent) return startYear === null ? 'Present' : `${startYear} – Present`;
  if (startYear === null && endYear === null) return '';
  if (startYear === null) return String(endYear);
  if (endYear === null) return String(startYear);
  return startYear === endYear ? String(startYear) : `${startYear} – ${endYear}`;
}

/**
 * Reverse chronological, the convention every reader expects.
 *
 * A current role outranks everything: it is the thing a recruiter looks for
 * first, and it has no end year to sort by, so it cannot be ordered correctly
 * by date alone.
 */
export function orderExperience(entries: readonly CvExperience[]): readonly CvExperience[] {
  return [...entries].sort((a, b) => {
    if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
    return (b.endYear ?? b.startYear ?? 0) - (a.endYear ?? a.startYear ?? 0);
  });
}

export function orderEducation(entries: readonly CvEducation[]): readonly CvEducation[] {
  return [...entries].sort((a, b) => (b.endYear ?? b.startYear ?? 0) - (a.endYear ?? a.startYear ?? 0));
}

/** "2016", "In progress", or nothing at all. */
export function certificateWhen(certificate: CvCertificate): string {
  if (certificate.isOngoing) return 'In progress';
  return certificate.year === null ? '' : String(certificate.year);
}

/** One line, for the templates that do not give a certificate its own block. */
export function certificateLine(certificate: CvCertificate): string {
  const when = certificateWhen(certificate);
  return [
    certificate.title,
    some(certificate.description),
    when === '' ? null : `(${when})`,
  ].filter((p): p is string => p !== null).join(' — ');
}

/** The contact line under the name. Empty parts are dropped, not left as gaps. */
export function contactLine(cv: CvData): string {
  return [cv.phone, cv.email, cv.location].filter((p): p is string => p !== null && p.trim() !== '')
    .map((p) => p.trim()).join('  ·  ');
}

/**
 * What a teacher typed into "what you did", turned into the shape they meant.
 *
 * They type a heading and then a run of dashed lines, because that is how
 * everyone writes a job description. Printing that verbatim gives a wall of
 * hyphens; guessing at every line gives a document that reformats itself
 * unpredictably. The rule is narrow enough to explain in one sentence:
 *
 *   * a line starting `-`, `*` or `•` is a bullet;
 *   * a plain line immediately above a bullet is that list's heading;
 *   * everything else is a paragraph.
 *
 * So "Key Responsibilities" followed by dashes comes out as a heading over a
 * list, and prose stays prose.
 */
export type DescriptionBlock =
  | { readonly kind: 'heading'; readonly text: string }
  | { readonly kind: 'paragraph'; readonly text: string }
  | { readonly kind: 'list'; readonly items: readonly string[] };

const BULLET = /^\s*[-*•]\s+(.*)$/;

export function describeBlocks(description: string): readonly DescriptionBlock[] {
  const lines = description.split('\n').map((l) => l.trimEnd()).filter((l) => l.trim() !== '');
  const blocks: DescriptionBlock[] = [];
  let list: string[] = [];

  const flush = () => {
    if (list.length > 0) {
      blocks.push({ kind: 'list', items: list });
      list = [];
    }
  };

  for (const [i, line] of lines.entries()) {
    const bullet = BULLET.exec(line);
    if (bullet !== null) {
      const item = (bullet[1] ?? '').trim();
      if (item !== '') list.push(item);
      continue;
    }
    flush();
    const next = lines[i + 1];
    const introducesAList = next !== undefined && BULLET.test(next);
    blocks.push({ kind: introducesAList ? 'heading' : 'paragraph', text: line.trim() });
  }
  flush();
  return blocks;
}

function renderBlocks(description: string, cls: { list: string; heading: string; para: string }): string {
  return describeBlocks(description).map((block) => {
    if (block.kind === 'list') {
      return `<ul class="${cls.list}">${block.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
    }
    const klass = block.kind === 'heading' ? cls.heading : cls.para;
    return `<p class="${klass}">${esc(block.text)}</p>`;
  }).join('');
}

// ---------------------------------------------------------------- the plain three

const FONTS: Readonly<Record<'classic' | 'modern' | 'compact', string>> = {
  classic: `"Times New Roman", Times, serif`,
  modern: `"Helvetica Neue", Helvetica, Arial, sans-serif`,
  compact: `"Helvetica Neue", Helvetica, Arial, sans-serif`,
};

function plainStyles(template: 'classic' | 'modern' | 'compact'): string {
  const tight = template === 'compact';
  return `
    @page { size: A4; margin: ${tight ? '12mm' : '16mm'}; }
    * { box-sizing: border-box; }
    body {
      font-family: ${FONTS[template]};
      font-size: ${tight ? '10.5pt' : '11pt'};
      line-height: ${tight ? 1.32 : 1.45};
      color: #111;
      margin: 0;
    }
    h1 { font-size: ${tight ? '18pt' : '21pt'}; margin: 0 0 2pt; letter-spacing: -0.2pt; }
    .headline { font-size: ${tight ? '10.5pt' : '11.5pt'}; color: #444; margin: 0 0 4pt; }
    .contact { font-size: ${tight ? '9.5pt' : '10pt'}; color: #333; }
    .head {
      ${template === 'modern' ? 'border-bottom: 2px solid #111; padding-bottom: 8pt;' : ''}
      ${template === 'classic' ? 'text-align: center; border-bottom: 1px solid #999; padding-bottom: 7pt;' : ''}
      margin-bottom: ${tight ? '9pt' : '13pt'};
    }
    h2 {
      font-size: ${tight ? '10.5pt' : '11.5pt'};
      text-transform: uppercase;
      letter-spacing: 0.6pt;
      border-bottom: 1px solid #bbb;
      padding-bottom: 2pt;
      margin: ${tight ? '11pt 0 5pt' : '15pt 0 7pt'};
    }
    /* Never split an entry across a page: a role's dates orphaned from its
       employer is the classic export bug, and it looks like carelessness. */
    .entry { margin-bottom: ${tight ? '6pt' : '9pt'}; page-break-inside: avoid; }
    .row { display: flex; justify-content: space-between; gap: 10pt; }
    .role { font-weight: 600; }
    .where { color: #333; }
    .years { color: #555; white-space: nowrap; font-size: ${tight ? '9.5pt' : '10pt'}; }
    .desc { margin: 2pt 0 0; color: #222; }
    .desc-head { margin: 4pt 0 1pt; font-weight: 600; color: #111; }
    .bullets { margin: 2pt 0 0; padding-left: 14pt; color: #222; }
    .subjects { margin: 0; color: #222; }
    .refs { display: grid; grid-template-columns: 1fr 1fr; gap: ${tight ? '6pt' : '10pt'}; }
    .ref { page-break-inside: avoid; }
    .muted { color: #555; }
  `;
}

function plainSection(title: string, inner: string): string {
  return inner.trim() === '' ? '' : `<h2>${esc(title)}</h2>${inner}`;
}

function plainBody(cv: CvData): string {
  const contact = contactLine(cv);
  const tsc = some(cv.tscNumber);

  const head = `
    <div class="head">
      <h1>${esc(cv.fullName)}</h1>
      ${some(cv.headline) === null ? '' : `<p class="headline">${esc(cv.headline as string)}</p>`}
      ${contact === '' ? '' : `<div class="contact">${esc(contact)}</div>`}
      ${tsc === null ? '' : `<div class="contact">TSC No. ${esc(tsc)}</div>`}
    </div>`;

  const summary = some(cv.summary) === null
    ? '' : plainSection('Profile', `<p class="desc">${esc(cv.summary as string)}</p>`);

  const subjects = cv.subjects.length === 0
    ? '' : plainSection('Subjects', `<p class="subjects">${esc(cv.subjects.join(', '))}</p>`);

  const skills = cv.skills.length === 0
    ? '' : plainSection('Skills', `<p class="subjects">${esc(cv.skills.join(', '))}</p>`);

  const role = (e: CvExperience) => `
    <div class="entry">
      <div class="row">
        <div><span class="role">${esc(e.role)}</span>${e.organisation.trim() === '' ? '' : ` <span class="where">— ${esc(e.organisation)}</span>`}</div>
        <div class="years">${esc(formatYearRange(e.startYear, e.endYear, e.isCurrent))}</div>
      </div>
      ${some(e.description) === null
        ? ''
        : renderBlocks(e.description as string, { list: 'bullets', heading: 'desc-head', para: 'desc' })}
    </div>`;

  const experience = plainSection('Experience', orderExperience(cv.experience).map(role).join(''));
  const volunteer = plainSection('Volunteer work', orderExperience(cv.volunteer).map(role).join(''));

  const education = plainSection('Education', orderEducation(cv.education).map((e) => `
    <div class="entry">
      <div class="row">
        <div><span class="role">${esc(e.qualification)}</span> <span class="where">— ${esc(e.institution)}</span></div>
        <div class="years">${esc(formatYearRange(e.startYear, e.endYear))}</div>
      </div>
      ${some(e.grade) === null ? '' : `<p class="desc muted">${esc(e.grade as string)}</p>`}
    </div>`).join(''));

  const list = (title: string, items: readonly string[]) => (items.length === 0
    ? ''
    : plainSection(title, `<p class="subjects">${esc(items.join(', '))}</p>`));

  const certificates = cv.certificates.length === 0 ? '' : plainSection(
    'Certificates',
    `<ul class="bullets">${cv.certificates.map((c) => `<li>${esc(certificateLine(c))}</li>`).join('')}</ul>`,
  );
  const responsibilities = cv.responsibilities.length === 0 ? '' : plainSection(
    'Positions of responsibility',
    `<ul class="bullets">${cv.responsibilities.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>`,
  );

  const referees = plainSection('Referees', cv.referees.length === 0 ? '' : `
    <div class="refs">
      ${cv.referees.map((r) => `
        <div class="ref">
          <div class="role">${esc(r.name)}</div>
          ${[r.title, r.organisation].filter((p): p is string => some(p) !== null)
            .map((p) => `<div class="muted">${esc(p.trim())}</div>`).join('')}
          ${[r.phone, r.email].filter((p): p is string => some(p) !== null)
            .map((p) => `<div>${esc(p.trim())}</div>`).join('')}
        </div>`).join('')}
    </div>`);

  return head + summary + subjects + skills + experience + education + volunteer
    + responsibilities + certificates + list('Languages', cv.languages)
    + list('Hobbies', cv.hobbies) + referees;
}

// ------------------------------------------------------------------- portrait

/**
 * Two columns, a photograph, and a blue rule down the outside edge.
 *
 * The layout is a float and not flexbox, and that is the whole trick. A CV
 * runs to two or three pages; a flex row fragments unpredictably across a page
 * break, while a floated sidebar with a margined main column is what every
 * print engine has agreed on for twenty years — the sidebar simply ends where
 * its content ends and the main column carries on at its own width.
 *
 * The blue edge is painted by the body background rather than by an element,
 * for the same reason: an element stops at the end of page one. A background
 * on `body` is painted across every page of the print canvas.
 */
const INK = '#2f74b5';
const BAR = '#3d7ea9';
const RULE = '#cfdae4';

/** 16×16 stroke glyphs, inline so nothing has to be fetched to print a CV. */
const GLYPH: Readonly<Record<string, string>> = {
  user: '<path d="M13.2 14v-1.2a3.2 3.2 0 0 0-3.2-3.2H6a3.2 3.2 0 0 0-3.2 3.2V14"/><circle cx="8" cy="5.2" r="2.6"/>',
  mail: '<rect x="2.4" y="3.9" width="11.2" height="8.2" rx="1.2"/><path d="M2.8 4.6 8 8.5l5.2-3.9"/>',
  phone: '<path d="M13.6 11.4v1.9a1.2 1.2 0 0 1-1.35 1.2 12.3 12.3 0 0 1-5.35-1.9 12.1 12.1 0 0 1-3.7-3.7A12.3 12.3 0 0 1 1.3 3.5 1.2 1.2 0 0 1 2.5 2.2h1.9a1.2 1.2 0 0 1 1.2 1.05c.08.6.22 1.2.42 1.76a1.2 1.2 0 0 1-.27 1.27l-.8.8a9.8 9.8 0 0 0 3.7 3.7l.8-.8a1.2 1.2 0 0 1 1.27-.27c.56.2 1.16.34 1.76.42a1.2 1.2 0 0 1 1.05 1.22z"/>',
  home: '<path d="M2.8 6.4 8 2.5l5.2 3.9V13a.9.9 0 0 1-.9.9H3.7a.9.9 0 0 1-.9-.9z"/><path d="M6.4 13.9V8.4h3.2v5.5"/>',
  calendar: '<rect x="2.4" y="3.4" width="11.2" height="10.2" rx="1.2"/><path d="M2.4 6.6h11.2M5.4 2.1v2.6M10.6 2.1v2.6"/>',
  // Venus and Mars together, so the row's icon does not itself assert a
  // gender before the teacher's own word for it has been read.
  gender: '<circle cx="7.4" cy="8.2" r="3.3"/><path d="M9.9 5.9 13.6 2.2M10.6 2.2h3v3"/><path d="M7.4 11.5v3M6 13h2.8"/>',
  flag: '<path d="M3.5 14V2.4M3.5 2.9h8.6L10.1 5.9l2 3H3.5"/>',
};

function icon(name: keyof typeof GLYPH | string): string {
  const paths = GLYPH[name] ?? '';
  return `<svg class="i" viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="${BAR}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

function portraitStyles(): string {
  return `
    /* No page margin: the blue edge has to reach the paper's edge, and the
       sheet supplies its own padding so it can clear the bar. */
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    body {
      font-family: "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif;
      font-size: 9.2pt;
      line-height: 1.42;
      color: #2b2b2b;
      margin: 0;
      background: linear-gradient(to right, ${BAR} 0, ${BAR} 9mm, #fff 9mm);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet { padding: 13mm 12mm 14mm 18mm; }

    .side { float: left; width: 48mm; }
    .main { margin-left: 57mm; }

    .photo {
      width: 38mm; height: 46mm; object-fit: cover;
      border-radius: 1.6mm; display: block; margin-bottom: 6mm;
    }

    /* Name and headline are one unit with one gap under them, so the first
       heading sits the same distance below whether a headline exists or not. */
    .namebar { margin-bottom: 5mm; }
    h1 {
      font-size: 21pt; font-weight: 700; color: ${INK};
      margin: 0; line-height: 1.15; letter-spacing: -0.2pt;
    }
    .headline { font-size: 10pt; color: #5a5a5a; margin: 1mm 0 0; }

    h2 {
      font-size: 12.5pt; font-weight: 600; color: ${INK};
      margin: 0 0 1.6mm; padding-bottom: 1mm;
      border-bottom: 1px solid ${RULE};
    }
    /* The sidebar's headings carry no rule: at 46mm a full-width underline
       reads as a divider between unrelated things rather than a heading. */
    .side h2 { border-bottom: none; padding-bottom: 0; font-size: 12pt; }
    .block { margin-bottom: 5.5mm; }
    .main .block { margin-bottom: 6mm; }

    .detail { display: flex; gap: 2.4mm; margin-bottom: 1.8mm; align-items: flex-start; font-size: 8.8pt; }
    .i { flex: 0 0 auto; margin-top: 0.6mm; }
    /* break-word and not anywhere: a long email should wrap only when it has
       to, rather than being chopped at whatever character hits the edge. */
    .detail span { min-width: 0; overflow-wrap: break-word; }

    .plain { margin: 0 0 1.4mm; }
    .dotted { margin: 0 0 1.6mm; padding-left: 3.6mm; position: relative; }
    /* A square, not a disc: it is the mark this template uses everywhere, and
       list-style cannot be coloured separately from the text beside it. */
    .dotted::before {
      content: ""; position: absolute; left: 0; top: 1.5mm;
      width: 1.5mm; height: 1.5mm; background: ${INK};
    }

    .entry { margin-bottom: 3.6mm; page-break-inside: avoid; }
    .entry-head { display: flex; justify-content: space-between; gap: 4mm; align-items: baseline; }
    .title { font-weight: 700; color: #1c1c1c; }
    .where { color: ${INK}; font-size: 8.8pt; }
    .years { color: ${INK}; font-size: 8.8pt; white-space: nowrap; }
    .grade { color: #5a5a5a; font-size: 8.8pt; }

    .desc { margin: 1.4mm 0 0; }
    .desc-head { margin: 2mm 0 0.6mm; font-weight: 700; color: #1c1c1c; }
    .bullets { margin: 1mm 0 0; padding-left: 4.6mm; }
    .bullets li { margin-bottom: 0.8mm; }

    .refs { display: grid; grid-template-columns: 1fr 1fr; gap: 2mm 5mm; }
    .refs .dotted { margin-bottom: 0; }
  `;
}

function portraitBlock(title: string, inner: string): string {
  return inner.trim() === '' ? '' : `<div class="block"><h2>${esc(title)}</h2>${inner}</div>`;
}

/**
 * Escaped, with the one break a reader would accept.
 *
 * A 48mm column cannot hold `endehelimaryline@example.com` on one line, and
 * left alone the browser breaks it at whatever character reaches the edge:
 * "endehelimaryline@example.co" and then a lonely "m". A `<wbr>` after the @
 * is the break everyone writes by hand, and the browser uses the last offered
 * opportunity that fits — so offering only that one is what makes it the one
 * taken. It disappears entirely when the address is short enough to fit.
 */
function breakableEmail(value: string): string {
  return esc(value).replace(/@/g, '@<wbr>');
}

function detailRow(glyph: string, value: string | null, html?: (v: string) => string): string {
  const text = some(value);
  return text === null
    ? ''
    : `<div class="detail">${icon(glyph)}<span>${(html ?? esc)(text)}</span></div>`;
}

function portraitBody(cv: CvData): string {
  // The address as an employer expects to see it: the line the teacher typed,
  // then "post code, city". Either half can be missing without leaving a gap.
  const cityLine = [some(cv.postCode), some(cv.location)].filter((p) => p !== null).join(' ');
  const home = [some(cv.address), cityLine === '' ? null : cityLine]
    .filter((p): p is string => p !== null).join('\n');

  const personal = portraitBlock('Personal details', [
    detailRow('user', cv.fullName),
    detailRow('mail', cv.email, breakableEmail),
    detailRow('phone', cv.phone),
    some(home) === null
      ? ''
      : `<div class="detail">${icon('home')}<span>${home.split('\n').map(esc).join('<br>')}</span></div>`,
    detailRow('calendar', cv.dateOfBirth),
    detailRow('gender', cv.gender),
    detailRow('flag', cv.nationality),
  ].join(''));

  const plainList = (title: string, items: readonly string[]) => portraitBlock(
    title,
    items.map((i) => `<p class="plain">${esc(i)}</p>`).join(''),
  );
  const dottedList = (title: string, items: readonly string[]) => portraitBlock(
    title,
    items.map((i) => `<p class="dotted">${esc(i)}</p>`).join(''),
  );

  const volunteer = portraitBlock('Volunteer work', orderExperience(cv.volunteer).map((v) => `
    <div class="entry">
      <p class="plain"><span class="title">${esc(v.role)}</span>${v.organisation.trim() === '' ? '' : ` — ${esc(v.organisation)}`}</p>
      ${formatYearRange(v.startYear, v.endYear, v.isCurrent) === ''
        ? ''
        : `<p class="years">${esc(formatYearRange(v.startYear, v.endYear, v.isCurrent))}</p>`}
    </div>`).join(''));

  const side = `<div class="side">
    ${cv.photoDataUri === null ? '' : `<img class="photo" src="${cv.photoDataUri}" alt="">`}
    ${personal}
    ${plainList('Skills', cv.skills)}
    ${plainList('Languages', cv.languages)}
    ${dottedList('Hobbies', cv.hobbies)}
    ${volunteer}
    ${dottedList('Responsibilities', cv.responsibilities)}
    ${portraitBlock('Certificates', cv.certificates.map((c) => `
      <div class="entry">
        <p class="plain"><span class="title">${esc(c.title)}</span></p>
        ${some(c.description) === null ? '' : `<p class="plain">${esc(c.description as string)}</p>`}
        ${certificateWhen(c) === '' ? '' : `<p class="years">${esc(certificateWhen(c))}</p>`}
      </div>`).join(''))}
  </div>`;

  const tsc = some(cv.tscNumber);
  const profile = portraitBlock('Profile', some(cv.summary) === null
    ? ''
    : `<p class="desc" style="margin-top:0">${esc(cv.summary as string)}</p>`);

  const education = portraitBlock('Education', orderEducation(cv.education).map((e) => `
    <div class="entry">
      <div class="entry-head">
        <div class="title">${esc(e.qualification)}</div>
        <div class="years">${esc(formatYearRange(e.startYear, e.endYear))}</div>
      </div>
      <div class="where">${esc(e.institution)}</div>
      ${some(e.grade) === null ? '' : `<div class="grade">${esc(e.grade as string)}</div>`}
    </div>`).join(''));

  const experience = portraitBlock('Experience', orderExperience(cv.experience).map((e) => `
    <div class="entry">
      <div class="entry-head">
        <div class="title">${esc(e.role)}</div>
        <div class="years">${esc(formatYearRange(e.startYear, e.endYear, e.isCurrent))}</div>
      </div>
      <div class="where">${esc(e.organisation)}</div>
      ${some(e.description) === null
        ? ''
        : renderBlocks(e.description as string, { list: 'bullets', heading: 'desc-head', para: 'desc' })}
    </div>`).join(''));

  const subjects = portraitBlock('Subjects', cv.subjects.length === 0
    ? ''
    : `<p class="desc" style="margin-top:0">${esc(cv.subjects.join(', '))}</p>`);

  // Each referee on one line, the way a head teacher writes them out: name,
  // what they are, where, and how to reach them.
  const referees = portraitBlock('Referees', cv.referees.length === 0 ? '' : `
    <div class="refs">
      ${cv.referees.map((r) => {
        const parts = [
          r.name,
          some(r.title),
          some(r.organisation),
          some(r.phone) === null ? null : `Tel. ${(r.phone as string).trim()}`,
          some(r.email),
        ].filter((p): p is string => p !== null && p.trim() !== '');
        return `<p class="dotted">${esc(parts.join(', '))}</p>`;
      }).join('')}
    </div>`);

  const main = `<div class="main">
    <div class="namebar">
      <h1>${esc(cv.fullName)}</h1>
      ${some(cv.headline) === null ? '' : `<p class="headline">${esc(cv.headline as string)}</p>`}
      ${tsc === null ? '' : `<p class="headline">TSC No. ${esc(tsc)}</p>`}
    </div>
    ${profile}
    ${education}
    ${experience}
    ${subjects}
    ${referees}
  </div>`;

  return `<div class="sheet">${side}${main}</div>`;
}

// ------------------------------------------------------------------ the shell

interface Layout {
  readonly css: string;
  readonly body: string;
  /** What the on-screen preview needs to look like a sheet of paper. */
  readonly previewCss: string;
}

function layout(cv: CvData, template: CvTemplate): Layout {
  if (template === 'portrait') {
    return {
      css: portraitStyles(),
      body: portraitBody(cv),
      // The sheet already carries its own padding, so the preview adds none.
      previewCss: `body { margin: 0 auto; max-width: ${CV_PAGE_WIDTH}px; min-height: 1123px; }`,
    };
  }
  return {
    css: plainStyles(template),
    body: plainBody(cv),
    // Margins come from @page, which only applies when printing, so the
    // preview supplies its own.
    previewCss: `body { background: #fff; margin: 0 auto; padding: 16mm; max-width: ${CV_PAGE_WIDTH}px; min-height: 1123px; }`,
  };
}

/** Render the CV as a standalone HTML document. */
export function renderCvHtml(cv: CvData, template: CvTemplate = 'portrait'): string {
  const { css, body } = layout(cv, template);
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${esc(cv.fullName)} — CV</title>
<style>${css}</style></head>
<body>${body}</body></html>`;
}

/**
 * The same document, wrapped so Word opens it as an editable file.
 *
 * This is HTML that Word understands, not OOXML. It opens and edits correctly
 * in Word, LibreOffice and Google Docs, which is what "download as Word" means
 * to someone applying for a job. A real .docx would need a zip writer and an
 * XML layer for no gain a teacher would notice.
 */
export function renderCvWordHtml(cv: CvData, template: CvTemplate = 'portrait'): string {
  return renderCvHtml(cv, template).replace(
    '<html>',
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
    'xmlns:w="urn:schemas-microsoft-com:office:word" ' +
    'xmlns="http://www.w3.org/TR/REC-html40">',
  );
}

/** `grace-wanjiru-cv` — safe on every filesystem, and readable in a share sheet. */
export function cvFileName(fullName: string, extension: string): string {
  const slug = fullName.toLowerCase().normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${slug === '' ? 'cv' : `${slug}-cv`}.${extension}`;
}

/** The width of an A4 page at 96dpi, in CSS pixels. */
export const CV_PAGE_WIDTH = 794;

/**
 * The exact same document, made to fit a phone-width viewport.
 *
 * It re-renders rather than restyling: a preview built from different HTML
 * than the export is worse than no preview, because it tells a teacher their
 * CV looks one way and then sends a different one. The only addition is a
 * viewport meta pinned to the page width, so the browser scales the whole A4
 * sheet down instead of reflowing it into a narrow column — reflowed text
 * would show line breaks that the PDF will not have.
 */
export function renderCvPreviewHtml(cv: CvData, template: CvTemplate = 'portrait'): string {
  const { previewCss } = layout(cv, template);
  return renderCvHtml(cv, template).replace(
    '<meta charset="utf-8">',
    `<meta charset="utf-8">` +
    `<meta name="viewport" content="width=${CV_PAGE_WIDTH}, initial-scale=1">` +
    `<style>html { background: #e9e9e9; } ${previewCss}</style>`,
  );
}
