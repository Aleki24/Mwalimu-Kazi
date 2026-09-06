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
  readonly location: string | null;
  readonly tscNumber: string | null;
  readonly subjects: readonly string[];
  readonly education: readonly CvEducation[];
  readonly experience: readonly CvExperience[];
  readonly referees: readonly CvReferee[];
}

export const CV_TEMPLATES = {
  classic: 'Classic',
  modern: 'Modern',
  compact: 'Compact',
} as const;
export type CvTemplate = keyof typeof CV_TEMPLATES;

/** What each template is for, shown next to its name in the picker. */
export const CV_TEMPLATE_HINT: Readonly<Record<CvTemplate, string>> = {
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

/** The contact line under the name. Empty parts are dropped, not left as gaps. */
export function contactLine(cv: CvData): string {
  return [cv.phone, cv.email, cv.location].filter((p): p is string => p !== null && p.trim() !== '')
    .map((p) => p.trim()).join('  ·  ');
}

const FONTS: Readonly<Record<CvTemplate, string>> = {
  classic: `"Times New Roman", Times, serif`,
  modern: `"Helvetica Neue", Helvetica, Arial, sans-serif`,
  compact: `"Helvetica Neue", Helvetica, Arial, sans-serif`,
};

function styles(template: CvTemplate): string {
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
    .desc { margin: 2pt 0 0; color: #222; white-space: pre-wrap; }
    .subjects { margin: 0; color: #222; }
    .refs { display: grid; grid-template-columns: 1fr 1fr; gap: ${tight ? '6pt' : '10pt'}; }
    .ref { page-break-inside: avoid; }
    .muted { color: #555; }
  `;
}

function section(title: string, inner: string): string {
  return inner.trim() === '' ? '' : `<h2>${esc(title)}</h2>${inner}`;
}

/** Render the CV as a standalone HTML document. */
export function renderCvHtml(cv: CvData, template: CvTemplate = 'classic'): string {
  const contact = contactLine(cv);

  const identity = [
    cv.tscNumber === null || cv.tscNumber.trim() === ''
      ? '' : `TSC No. ${esc(cv.tscNumber.trim())}`,
  ].filter((p) => p !== '').join('  ·  ');

  const head = `
    <div class="head">
      <h1>${esc(cv.fullName)}</h1>
      ${cv.headline === null || cv.headline.trim() === '' ? '' : `<p class="headline">${esc(cv.headline)}</p>`}
      ${contact === '' ? '' : `<div class="contact">${esc(contact)}</div>`}
      ${identity === '' ? '' : `<div class="contact">${identity}</div>`}
    </div>`;

  const summary = cv.summary === null || cv.summary.trim() === ''
    ? '' : section('Profile', `<p class="desc">${esc(cv.summary.trim())}</p>`);

  const subjects = cv.subjects.length === 0
    ? '' : section('Subjects', `<p class="subjects">${esc(cv.subjects.join(', '))}</p>`);

  const experience = section('Experience', orderExperience(cv.experience).map((e) => `
    <div class="entry">
      <div class="row">
        <div><span class="role">${esc(e.role)}</span>${e.organisation.trim() === '' ? '' : ` <span class="where">— ${esc(e.organisation)}</span>`}</div>
        <div class="years">${esc(formatYearRange(e.startYear, e.endYear, e.isCurrent))}</div>
      </div>
      ${e.description === null || e.description.trim() === '' ? '' : `<p class="desc">${esc(e.description.trim())}</p>`}
    </div>`).join(''));

  const education = section('Education', orderEducation(cv.education).map((e) => `
    <div class="entry">
      <div class="row">
        <div><span class="role">${esc(e.qualification)}</span> <span class="where">— ${esc(e.institution)}</span></div>
        <div class="years">${esc(formatYearRange(e.startYear, e.endYear))}</div>
      </div>
      ${e.grade === null || e.grade.trim() === '' ? '' : `<p class="desc muted">${esc(e.grade.trim())}</p>`}
    </div>`).join(''));

  const referees = section('Referees', cv.referees.length === 0 ? '' : `
    <div class="refs">
      ${cv.referees.map((r) => `
        <div class="ref">
          <div class="role">${esc(r.name)}</div>
          ${[r.title, r.organisation].filter((p): p is string => p !== null && p.trim() !== '')
            .map((p) => `<div class="muted">${esc(p)}</div>`).join('')}
          ${[r.phone, r.email].filter((p): p is string => p !== null && p.trim() !== '')
            .map((p) => `<div>${esc(p)}</div>`).join('')}
        </div>`).join('')}
    </div>`);

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${esc(cv.fullName)} — CV</title>
<style>${styles(template)}</style></head>
<body>${head}${summary}${subjects}${experience}${education}${referees}</body></html>`;
}

/**
 * The same document, wrapped so Word opens it as an editable file.
 *
 * This is HTML that Word understands, not OOXML. It opens and edits correctly
 * in Word, LibreOffice and Google Docs, which is what "download as Word" means
 * to someone applying for a job. A real .docx would need a zip writer and an
 * XML layer for no gain a teacher would notice.
 */
export function renderCvWordHtml(cv: CvData, template: CvTemplate = 'classic'): string {
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
