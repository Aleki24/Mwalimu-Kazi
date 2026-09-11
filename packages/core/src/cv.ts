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

/**
 * A language, and how well.
 *
 * `level` is 1–5 or nothing at all. Nothing is the honest default: several of
 * these templates draw five dots beside a language, and filling them in for a
 * teacher who never said would be the app putting a claim in their mouth.
 */
export interface CvLanguage {
  readonly name: string;
  readonly level: number | null;
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
  readonly languages: readonly CvLanguage[];
  readonly hobbies: readonly string[];
  readonly responsibilities: readonly string[];
  readonly certificates: readonly CvCertificate[];
  readonly volunteer: readonly CvExperience[];
}

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

// ------------------------------------------------------------------ the style
//
// A CV is one document with a lot of dials, not eleven documents. Every
// template below is a preset of the same few choices — how the page is laid
// out, what colour the headings are, which face it is set in, how tight the
// spacing runs — and the teacher can then move any dial without leaving the
// template. Building each look as its own stylesheet would have meant eleven
// copies of the entry spacing, and a fix to one of them.

/** How the page is built. The one choice the others hang off. */
export const CV_LAYOUTS = {
  /** Photograph and details down a sidebar, the career beside it. */
  sidebar: 'sidebar',
  /** Dates in a left gutter, entries in a column beside them. */
  timeline: 'timeline',
  /** One column, full width. What an ATS reads most reliably. */
  stacked: 'stacked',
} as const;
export type CvLayout = keyof typeof CV_LAYOUTS;

/** What the sidebar is made of, when there is one. */
export type CvSidebar = 'edge' | 'banner' | 'filled' | 'tint';

/** Whether a heading is underlined or set in a filled bar. */
export type CvHeading = 'rule' | 'band';

export const CV_ACCENTS = {
  ink: 'Ink',
  indigo: 'Indigo',
  teal: 'Teal',
  maroon: 'Maroon',
  violet: 'Violet',
  slate: 'Slate',
  terracotta: 'Terracotta',
} as const;
export type CvAccent = keyof typeof CV_ACCENTS;

interface Palette {
  /** Headings, dates, the organisation under an entry. */
  readonly line: string;
  /** Filled areas: a sidebar, a banner, a heading band. */
  readonly deep: string;
  /** A tint of it, pale enough to set body text on. */
  readonly wash: string;
}

const PALETTE: Readonly<Record<CvAccent, Palette>> = {
  ink: { line: '#1c1c1c', deep: '#111111', wash: '#f1f1f1' },
  indigo: { line: '#2f74b5', deep: '#3d7ea9', wash: '#eef4fa' },
  teal: { line: '#1d7a6b', deep: '#4f9c8a', wash: '#ecf5f2' },
  maroon: { line: '#9c3b2e', deep: '#a63f2f', wash: '#fbefec' },
  violet: { line: '#5a4b9c', deep: '#6d5cc0', wash: '#f0eefa' },
  slate: { line: '#44505c', deep: '#5b6875', wash: '#eef1f4' },
  terracotta: { line: '#b05a34', deep: '#c06c44', wash: '#fbf1ea' },
};

/**
 * Faces that are already on the device.
 *
 * No web fonts. The PDF is rendered by the browser engine on the phone, often
 * with no network — a face that fails to fetch does not fall back visibly, it
 * silently reflows the whole document, and the teacher sends something they
 * never saw. Everything here resolves from the system.
 */
export const CV_FONTS = {
  helvetica: 'Helvetica',
  arial: 'Arial',
  system: 'System',
  georgia: 'Georgia',
  garamond: 'Garamond',
  times: 'Times New Roman',
  trebuchet: 'Trebuchet',
  courier: 'Courier New',
} as const;
export type CvFont = keyof typeof CV_FONTS;

const STACK: Readonly<Record<CvFont, string>> = {
  helvetica: `"Helvetica Neue", Helvetica, Arial, sans-serif`,
  arial: `Arial, "Helvetica Neue", Helvetica, sans-serif`,
  system: `"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`,
  georgia: `Georgia, "Times New Roman", Times, serif`,
  garamond: `Garamond, "Palatino Linotype", Palatino, "Times New Roman", serif`,
  times: `"Times New Roman", Times, serif`,
  trebuchet: `"Trebuchet MS", "Lucida Grande", Tahoma, sans-serif`,
  courier: `"Courier New", Courier, monospace`,
};

/** A faint texture on the page. Anything stronger fights the words. */
export const CV_BACKGROUNDS = {
  none: 'Plain',
  dots: 'Dots',
  lines: 'Lines',
} as const;
export type CvBackground = keyof typeof CV_BACKGROUNDS;

/**
 * The dials, and where each one sits.
 *
 * 1–5 rather than points and millimetres: the teacher is choosing "a bit
 * tighter", not typesetting, and a scale cannot produce a document with
 * four-point text or forty-millimetre margins the way a free number can.
 */
export type CvScale = 1 | 2 | 3 | 4 | 5;

export interface CvStyle {
  readonly template: CvTemplate;
  readonly accent: CvAccent;
  readonly font: CvFont;
  readonly fontScale: CvScale;
  readonly lineHeight: CvScale;
  /** Space between one role and the next. */
  readonly entrySpacing: CvScale;
  readonly sectionSpacing: CvScale;
  readonly margins: CvScale;
  readonly background: CvBackground;
}

export const CV_SCALE_LABEL: Readonly<Record<CvScale, string>> = {
  1: 'XS', 2: 'S', 3: 'M', 4: 'L', 5: 'XL',
};

const FONT_PT: Readonly<Record<CvScale, number>> = { 1: 8.2, 2: 8.7, 3: 9.2, 4: 9.8, 5: 10.5 };
const LEADING: Readonly<Record<CvScale, number>> = { 1: 1.2, 2: 1.3, 3: 1.42, 4: 1.55, 5: 1.7 };
/** Millimetres, for entry gaps, section gaps and page margins in turn. */
const ENTRY_MM: Readonly<Record<CvScale, number>> = { 1: 1.8, 2: 2.6, 3: 3.6, 4: 4.8, 5: 6.2 };
const SECTION_MM: Readonly<Record<CvScale, number>> = { 1: 3, 2: 4.2, 3: 5.8, 4: 7.4, 5: 9.5 };
const MARGIN_MM: Readonly<Record<CvScale, number>> = { 1: 8, 2: 10.5, 3: 13, 4: 16, 5: 19 };

interface Preset {
  readonly layout: CvLayout;
  readonly sidebar: CvSidebar;
  readonly headings: CvHeading;
  readonly accent: CvAccent;
  readonly font: CvFont;
  /** Whether the name is set in wide capitals, as the sidebar templates do. */
  readonly capitalName: boolean;
}

export const CV_TEMPLATES = {
  portrait: 'Portrait',
  banner: 'Banner',
  bold: 'Bold',
  timeline: 'Timeline',
  label: 'Label',
  classic: 'Classic',
} as const;
export type CvTemplate = keyof typeof CV_TEMPLATES;

const PRESET: Readonly<Record<CvTemplate, Preset>> = {
  portrait: { layout: 'sidebar', sidebar: 'edge', headings: 'rule', accent: 'indigo', font: 'system', capitalName: false },
  banner: { layout: 'sidebar', sidebar: 'banner', headings: 'rule', accent: 'indigo', font: 'system', capitalName: true },
  bold: { layout: 'sidebar', sidebar: 'filled', headings: 'rule', accent: 'maroon', font: 'system', capitalName: true },
  timeline: { layout: 'timeline', sidebar: 'edge', headings: 'rule', accent: 'indigo', font: 'system', capitalName: true },
  label: { layout: 'stacked', sidebar: 'edge', headings: 'band', accent: 'ink', font: 'system', capitalName: true },
  classic: { layout: 'stacked', sidebar: 'edge', headings: 'rule', accent: 'ink', font: 'times', capitalName: false },
};

/** What each template is for, shown next to its name in the picker. */
export const CV_TEMPLATE_HINT: Readonly<Record<CvTemplate, string>> = {
  portrait: 'Photograph and details down the side, a blue rule along the edge. What most Kenyan employers expect to receive.',
  banner: 'The same two columns, with your name in a coloured plate at the top of the sidebar.',
  bold: 'A solid colour down the whole side. It stands out in a pile, and it uses a lot of ink.',
  timeline: 'Dates in a column of their own, so a reader can follow your years down the page.',
  label: 'One column, headings in filled labels. Plain enough for any system that reads CVs automatically.',
  classic: 'One column, set in a serif. The safe choice for TSC and county applications.',
};

/** The settings a template starts on. Every one of them can then be changed. */
export function styleFor(template: CvTemplate): CvStyle {
  const preset = PRESET[template];
  return {
    template,
    accent: preset.accent,
    font: preset.font,
    fontScale: 3,
    lineHeight: 3,
    entrySpacing: 3,
    sectionSpacing: 3,
    margins: 3,
    background: 'none',
  };
}

/** The default document, for callers that have no stored preference yet. */
export const DEFAULT_CV_STYLE: CvStyle = styleFor('portrait');

// ------------------------------------------------------------------- drawing
//
// One stylesheet, one body builder, both parameterised. The three layouts
// differ in how the page is divided and in nothing else: an entry, a heading,
// a bulleted description and a dotted list are the same in all of them, which
// is the whole reason they can share the dials above.

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
  // A chevron, as the reference templates use for the rows a teacher adds
  // themselves. The first attempt drew an up-arrow, which read as "upload".
  badge: '<path d="M6.2 3.4 10.8 8l-4.6 4.6"/>',
};

function icon(name: string, colour: string): string {
  const paths = GLYPH[name] ?? '';
  return `<svg class="i" viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="${colour}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
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

const PAGE_TEXTURE: Readonly<Record<CvBackground, string>> = {
  none: '',
  dots: `radial-gradient(circle at 1px 1px, rgba(0,0,0,.10) 1px, transparent 0) 0 0/4mm 4mm`,
  lines: `repeating-linear-gradient(45deg, rgba(0,0,0,.055) 0 1px, transparent 1px 4mm)`,
};

interface Frame {
  readonly style: CvStyle;
  readonly preset: Preset;
  readonly palette: Palette;
  /** Body text colour inside a filled sidebar, which is the only inverted area. */
  readonly onFill: string;
}

function frame(style: CvStyle): Frame {
  return {
    style,
    preset: PRESET[style.template],
    palette: PALETTE[style.accent],
    onFill: '#ffffff',
  };
}

function styles(f: Frame): string {
  const { style, preset, palette } = f;
  const pt = FONT_PT[style.fontScale];
  const lead = LEADING[style.lineHeight];
  const entry = ENTRY_MM[style.entrySpacing];
  const section = SECTION_MM[style.sectionSpacing];
  const margin = MARGIN_MM[style.margins];
  const texture = PAGE_TEXTURE[style.background];

  const sidebarWidth = 48;
  // The sheet's left padding has to clear whatever the sidebar variant paints
  // underneath it, and the main column has to start clear of the sidebar.
  const padLeft = preset.layout !== 'sidebar' ? margin
    : preset.sidebar === 'edge' ? margin + 5
    : preset.sidebar === 'filled' ? Math.max(margin - 3, 7)
    : margin;
  const mainLeft = sidebarWidth + 9;
  const fillTo = padLeft + sidebarWidth + 5;

  /*
    The sidebar's colour is painted by the body background, not by the sidebar
    element, and that is the only reason a CV longer than one page looks right:
    an element stops at the end of page one, while a background on `body` is
    painted across the whole print canvas. The same trick draws the thin edge
    rule and the page texture.
  */
  const fill = preset.layout !== 'sidebar' ? ''
    : preset.sidebar === 'edge'
      ? `linear-gradient(to right, ${palette.deep} 0, ${palette.deep} ${Math.max(margin - 4, 5)}mm, #fff ${Math.max(margin - 4, 5)}mm)`
      : preset.sidebar === 'filled'
        ? `linear-gradient(to right, ${palette.deep} 0, ${palette.deep} ${fillTo}mm, #fff ${fillTo}mm)`
        : preset.sidebar === 'tint'
          ? `linear-gradient(to right, ${palette.wash} 0, ${palette.wash} ${fillTo}mm, #fff ${fillTo}mm)`
          : '';
  const layers = [texture, fill].filter((l) => l !== '').join(', ');

  const inverted = preset.layout === 'sidebar' && preset.sidebar === 'filled';
  const sideInk = inverted ? f.onFill : palette.line;
  const sideText = inverted ? 'rgba(255,255,255,.92)' : '#2b2b2b';
  const sideRule = inverted ? 'rgba(255,255,255,.35)' : '#d8dee4';

  return `
    /* No page margin: a filled sidebar and an edge rule both have to reach the
       paper's edge, so the sheet supplies its own padding instead. */
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    body {
      font-family: ${STACK[style.font]};
      font-size: ${pt}pt;
      line-height: ${lead};
      color: #2b2b2b;
      margin: 0;
      background: ${layers === '' ? '#fff' : `${layers}, #fff`};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet { padding: ${margin}mm ${margin}mm ${margin + 1}mm ${padLeft}mm; }

    h1 {
      font-size: ${(pt * 2.28).toFixed(1)}pt;
      font-weight: 700;
      color: ${palette.line};
      margin: 0;
      line-height: 1.14;
      ${preset.capitalName ? 'letter-spacing: 0.22em; text-transform: uppercase;' : 'letter-spacing: -0.2pt;'}
    }
    .namebar { margin-bottom: ${section}mm;
      ${preset.headings === 'band' ? `padding-bottom: 2.5mm; border-bottom: 1.2mm solid ${palette.deep};` : ''} }
    .headline { font-size: ${(pt * 1.08).toFixed(1)}pt; color: #5a5a5a; margin: 1mm 0 0; }

    h2 {
      font-size: ${(pt * 1.36).toFixed(1)}pt;
      font-weight: 600;
      color: ${palette.line};
      margin: 0 0 1.6mm;
      ${preset.headings === 'band'
        ? `background: ${palette.deep}; color: #fff; display: inline-block; padding: 0.8mm 2.2mm; letter-spacing: 0.04em; text-transform: uppercase;`
        : `padding-bottom: 1mm; border-bottom: 1px solid ${palette.line}33;`}
    }
    .block { margin-bottom: ${section}mm; }

    /* Entries never split across a page: a role's dates orphaned from its
       employer is the classic export bug, and it looks like carelessness. */
    .entry { margin-bottom: ${entry}mm; page-break-inside: avoid; }
    .entry:last-child { margin-bottom: 0; }
    .entry-head { display: flex; justify-content: space-between; gap: 4mm; align-items: baseline; }
    .title { font-weight: 700; color: #1c1c1c; }
    .where { color: ${palette.line}; font-size: ${(pt * 0.95).toFixed(1)}pt; }
    .years { color: ${palette.line}; font-size: ${(pt * 0.95).toFixed(1)}pt; white-space: nowrap; }
    .grade { color: #5a5a5a; font-size: ${(pt * 0.95).toFixed(1)}pt; }

    .desc { margin: 1.4mm 0 0; }
    .desc-head { margin: 2mm 0 0.6mm; font-weight: 700; color: #1c1c1c; }
    .bullets { margin: 1mm 0 0; padding-left: 4.6mm; }
    .bullets li { margin-bottom: 0.8mm; }

    .plain { margin: 0 0 1.4mm; }
    .dotted { margin: 0 0 1.6mm; padding-left: 3.6mm; position: relative; }
    /* A square, not a disc: it is the mark these templates use everywhere, and
       list-style cannot be coloured separately from the text beside it. */
    .dotted::before {
      content: ""; position: absolute; left: 0; top: ${(lead * pt * 0.36).toFixed(2)}pt;
      width: 1.5mm; height: 1.5mm; background: ${palette.line};
    }
    .two { display: grid; grid-template-columns: 1fr 1fr; gap: 1.6mm 6mm; }

    .detail { display: flex; gap: 2.4mm; margin-bottom: 1.8mm; align-items: flex-start;
              font-size: ${(pt * 0.95).toFixed(1)}pt; }
    .i { flex: 0 0 auto; margin-top: 0.6mm; }
    /* break-word and not anywhere: a long email should wrap only when it has
       to, rather than being chopped at whatever character hits the edge. */
    .detail span { min-width: 0; overflow-wrap: break-word; }

    /* Five dots, the ones a teacher claimed filled. Drawn rather than written
       because "Kiswahili — 4/5" on a CV reads like a school report. */
    .dots { display: inline-flex; gap: 1mm; }
    .dot { width: 1.6mm; height: 1.6mm; border-radius: 50%; background: ${palette.line}; }
    .dot.off { background: ${palette.line}33; }

    /* ---- the sidebar layout */
    .side { float: left; width: ${sidebarWidth}mm; }
    .main { margin-left: ${mainLeft}mm; }
    .side h2 { border-bottom: none; padding-bottom: 0; color: ${sideInk};
               ${preset.headings === 'band' ? `background: ${inverted ? 'rgba(255,255,255,.16)' : palette.deep};` : ''} }
    .side, .side .title, .side .plain, .side .where, .side .years { color: ${sideText}; }
    .side .title { font-weight: 700; }
    .side .dotted::before { background: ${sideInk}; }
    .side .dot { background: ${sideInk}; }
    .side .dot.off { background: ${inverted ? 'rgba(255,255,255,.3)' : `${palette.line}33`}; }
    .side .rule { border-top: 1px solid ${sideRule}; margin: 0 0 2mm; }
    /* The year goes under the title in the sidebar, not beside it: 48mm is not
       enough for both, and squeezing them onto one row wrapped "Football coach
       and learner mentor" into a three-line stack beside its dates. */
    .side .entry-head { display: block; }
    .side .years { display: block; margin-top: 0.4mm; }

    .nameplate {
      background: ${palette.deep}; color: #fff; text-align: center;
      padding: 6mm 3mm 7mm; margin-bottom: ${section}mm;
      border-radius: 0 0 42% 42% / 0 0 7mm 7mm;
    }
    .nameplate h1 { color: #fff; font-size: ${(pt * 1.5).toFixed(1)}pt; }

    .photo {
      width: 38mm; height: 46mm; object-fit: cover;
      border-radius: 1.6mm; display: block; margin-bottom: ${section}mm;
    }

    /* ---- the timeline layout */
    .tl-head { color: ${palette.line}; font-weight: 600;
               font-size: ${(pt * 1.36).toFixed(1)}pt; margin: 0 0 2mm; }
    .tl-row { display: flex; gap: 4mm; margin-bottom: ${entry}mm; page-break-inside: avoid; }
    .tl-when { flex: 0 0 32mm; font-weight: 700; font-size: ${(pt * 0.95).toFixed(1)}pt; color: #1c1c1c; }
    .tl-mark { flex: 0 0 auto; width: 1.8mm; height: 1.8mm; margin-top: ${(lead * pt * 0.34).toFixed(2)}pt;
               background: ${palette.line}; }
    .tl-what { min-width: 0; flex: 1; }
    .tl-card { border-bottom: 1px solid ${palette.line}22; padding-bottom: ${section * 0.6}mm;
               margin-bottom: ${section}mm; }
    .tl-card:last-child { border-bottom: none; }

    /* ---- the stacked layout */
    .stack .entry-head { gap: 6mm; }
    .refs { display: grid; grid-template-columns: 1fr 1fr; gap: 2mm 5mm; }
    .refs .dotted { margin-bottom: 0; }
  `;
}

/** The sections, as data, so each layout only decides where to put them. */
interface Piece {
  readonly title: string;
  readonly html: string;
}

const piece = (title: string, html: string): readonly Piece[] =>
  (html.trim() === '' ? [] : [{ title, html }]);

function detailRow(f: Frame, glyph: string, value: string | null, html?: (v: string) => string): string {
  const text = some(value);
  const colour = f.preset.layout === 'sidebar' && f.preset.sidebar === 'filled'
    ? f.onFill : f.palette.deep;
  return text === null
    ? ''
    : `<div class="detail">${icon(glyph, colour)}<span>${(html ?? esc)(text)}</span></div>`;
}

/** Everything in the "Personal details" panel, in the order a form asks it. */
function personalDetails(f: Frame, cv: CvData): string {
  // The address as an employer expects to see it: the line the teacher typed,
  // then "post code, city". Either half can be missing without leaving a gap.
  const cityLine = [some(cv.postCode), some(cv.location)].filter((p) => p !== null).join(' ');
  const home = [some(cv.address), cityLine === '' ? null : cityLine]
    .filter((p): p is string => p !== null).join('\n');
  const colour = f.preset.layout === 'sidebar' && f.preset.sidebar === 'filled'
    ? f.onFill : f.palette.deep;

  return [
    detailRow(f, 'user', cv.fullName),
    detailRow(f, 'mail', cv.email, breakableEmail),
    detailRow(f, 'phone', cv.phone),
    home === ''
      ? ''
      : `<div class="detail">${icon('home', colour)}<span>${home.split('\n').map(esc).join('<br>')}</span></div>`,
    detailRow(f, 'calendar', cv.dateOfBirth),
    detailRow(f, 'gender', cv.gender),
    detailRow(f, 'flag', cv.nationality),
    some(cv.tscNumber) === null
      ? ''
      : detailRow(f, 'badge', `TSC Registered Teacher No. ${(cv.tscNumber as string).trim()}`),
  ].join('');
}

/** Five dots, filled to the level the teacher claimed. */
function dots(level: number): string {
  return `<span class="dots">${[1, 2, 3, 4, 5]
    .map((n) => `<span class="dot${n <= level ? '' : ' off'}"></span>`).join('')}</span>`;
}

function languageRows(cv: CvData): string {
  return cv.languages.map((l) => (l.level === null
    ? `<p class="plain">${esc(l.name)}</p>`
    : `<div class="detail" style="justify-content:space-between"><span>${esc(l.name)}</span>${dots(l.level)}</div>`))
    .join('');
}

const plainLines = (items: readonly string[]): string =>
  items.map((i) => `<p class="plain">${esc(i)}</p>`).join('');

const dottedLines = (items: readonly string[]): string =>
  items.map((i) => `<p class="dotted">${esc(i)}</p>`).join('');

/** One referee on one line, the way a head teacher writes them out. */
function refereeLine(r: CvReferee): string {
  return [
    r.name,
    some(r.title),
    some(r.organisation),
    some(r.phone) === null ? null : `Tel. ${(r.phone as string).trim()}`,
    some(r.email),
  ].filter((p): p is string => p !== null && p.trim() !== '').join(', ');
}

function roleEntry(e: CvExperience): string {
  return `
    <div class="entry">
      <div class="entry-head">
        <div class="title">${esc(e.role)}</div>
        <div class="years">${esc(formatYearRange(e.startYear, e.endYear, e.isCurrent))}</div>
      </div>
      ${e.organisation.trim() === '' ? '' : `<div class="where">${esc(e.organisation)}</div>`}
      ${some(e.description) === null
        ? ''
        : renderBlocks(e.description as string, { list: 'bullets', heading: 'desc-head', para: 'desc' })}
    </div>`;
}

function educationEntry(e: CvEducation): string {
  return `
    <div class="entry">
      <div class="entry-head">
        <div class="title">${esc(e.qualification)}</div>
        <div class="years">${esc(formatYearRange(e.startYear, e.endYear))}</div>
      </div>
      <div class="where">${esc(e.institution)}</div>
      ${some(e.grade) === null ? '' : `<div class="grade">${esc(e.grade as string)}</div>`}
    </div>`;
}

function certificateEntry(c: CvCertificate): string {
  return `
    <div class="entry">
      <div class="entry-head">
        <div class="title">${esc(c.title)}</div>
        <div class="years">${esc(certificateWhen(c))}</div>
      </div>
      ${some(c.description) === null ? '' : `<div class="grade">${esc(c.description as string)}</div>`}
    </div>`;
}

/** What goes beside the career, when there is a column for it. */
function asidePieces(f: Frame, cv: CvData): readonly Piece[] {
  return [
    ...piece('Personal details', personalDetails(f, cv)),
    ...piece('Skills', plainLines(cv.skills)),
    ...piece('Languages', languageRows(cv)),
    ...piece('Hobbies', dottedLines(cv.hobbies)),
    ...piece('Volunteer work', orderExperience(cv.volunteer).map(roleEntry).join('')),
    ...piece('Responsibilities', dottedLines(cv.responsibilities)),
    ...piece('Certificates', cv.certificates.map(certificateEntry).join('')),
  ];
}

/** The career itself. */
function mainPieces(cv: CvData): readonly Piece[] {
  return [
    ...piece('Profile', some(cv.summary) === null
      ? '' : `<p class="desc" style="margin-top:0">${esc(cv.summary as string)}</p>`),
    ...piece('Education', orderEducation(cv.education).map(educationEntry).join('')),
    ...piece('Employment', orderExperience(cv.experience).map(roleEntry).join('')),
    ...piece('Subjects', cv.subjects.length === 0
      ? '' : `<p class="desc" style="margin-top:0">${esc(cv.subjects.join(', '))}</p>`),
    ...piece('Referees', cv.referees.length === 0
      ? ''
      : `<div class="refs">${cv.referees
          .map((r) => `<p class="dotted">${esc(refereeLine(r))}</p>`).join('')}</div>`),
  ];
}

const block = (p: Piece): string =>
  `<div class="block"><h2>${esc(p.title)}</h2>${p.html}</div>`;

/*
  The TSC number is not here, deliberately.

  It belongs in Personal details, which every layout renders, and printing it
  under the name as well put it on the page twice on the one-column templates —
  a duplication nobody notices while writing the layout and everybody notices
  on the printed page.
*/
function nameBar(_f: Frame, cv: CvData): string {
  return `
    <div class="namebar">
      <h1>${esc(cv.fullName)}</h1>
      ${some(cv.headline) === null ? '' : `<p class="headline">${esc(cv.headline as string)}</p>`}
    </div>`;
}

function sidebarBody(f: Frame, cv: CvData): string {
  const banner = f.preset.sidebar === 'banner';
  const side = `<div class="side">
    ${banner ? `<div class="nameplate"><h1>${esc(cv.fullName)}</h1></div>` : ''}
    ${cv.photoDataUri === null ? '' : `<img class="photo" src="${cv.photoDataUri}" alt="">`}
    ${asidePieces(f, cv).map(block).join('')}
  </div>`;

  const main = `<div class="main">
    ${banner ? '' : nameBar(f, cv)}
    ${mainPieces(cv).map(block).join('')}
  </div>`;

  return `<div class="sheet">${side}${main}</div>`;
}

/**
 * Dates in a gutter of their own.
 *
 * Every section becomes rows of "when | marker | what", so a reader following
 * the left edge of the page reads a career in order without their eye having
 * to re-find the date inside each entry.
 */
function timelineBody(f: Frame, cv: CvData): string {
  const row = (when: string, what: string): string => `
    <div class="tl-row">
      <div class="tl-when">${esc(when)}</div>
      <div class="tl-mark"></div>
      <div class="tl-what">${what}</div>
    </div>`;

  /*
    A row with nothing in the gutter keeps the gutter but loses the marker.
    Skills and hobbies have no date, and a square sitting alone beside a
    two-column grid reads as a bullet for the whole list rather than as the
    timeline mark it is everywhere else.
  */
  const bare = (what: string): string => `
    <div class="tl-row">
      <div class="tl-when"></div>
      <div class="tl-mark" style="background:transparent"></div>
      <div class="tl-what">${what}</div>
    </div>`;

  const section = (title: string, rows: string): string =>
    (rows.trim() === '' ? '' : `<div class="tl-card"><div class="tl-head">${esc(title)}</div>${rows}</div>`);

  const roleRows = (entries: readonly CvExperience[]): string =>
    orderExperience(entries).map((e) => row(
      formatYearRange(e.startYear, e.endYear, e.isCurrent),
      `<div class="title">${esc(e.role)}</div>
       ${e.organisation.trim() === '' ? '' : `<div class="where">${esc(e.organisation)}</div>`}
       ${some(e.description) === null
        ? ''
        : renderBlocks(e.description as string, { list: 'bullets', heading: 'desc-head', para: 'desc' })}`,
    )).join('');

  const head = `
    <div class="tl-card">
      ${cv.photoDataUri === null
        ? ''
        : `<img class="photo" src="${cv.photoDataUri}" alt="" style="float:right;margin-left:8mm">`}
      ${nameBar(f, cv)}
      <div class="two">${personalDetails(f, cv)}</div>
      ${some(cv.summary) === null ? '' : `<p class="desc">${esc(cv.summary as string)}</p>`}
    </div>`;

  const lists = [
    ['Skills', cv.skills.length === 0 ? '' : `<div class="two">${plainLines(cv.skills)}</div>`],
    ['Languages', cv.languages.length === 0 ? '' : `<div class="two">${languageRows(cv)}</div>`],
    ['Hobbies', cv.hobbies.length === 0 ? '' : `<div class="two">${dottedLines(cv.hobbies)}</div>`],
    ['Responsibilities', cv.responsibilities.length === 0 ? '' : `<div class="two">${dottedLines(cv.responsibilities)}</div>`],
    ['Subjects', cv.subjects.length === 0 ? '' : `<p class="desc" style="margin:0">${esc(cv.subjects.join(', '))}</p>`],
    ['Referees', cv.referees.length === 0 ? '' : `<div class="two">${cv.referees.map((r) => `<p class="dotted">${esc(refereeLine(r))}</p>`).join('')}</div>`],
  ] as const;

  return `<div class="sheet">
    ${head}
    ${section('Education', orderEducation(cv.education).map((e) => row(
      formatYearRange(e.startYear, e.endYear),
      `<div class="title">${esc(e.qualification)}</div>
       <div class="where">${esc(e.institution)}</div>
       ${some(e.grade) === null ? '' : `<div class="grade">${esc(e.grade as string)}</div>`}`,
    )).join(''))}
    ${section('Employment', roleRows(cv.experience))}
    ${section('Volunteer work', roleRows(cv.volunteer))}
    ${section('Certificates', cv.certificates.map((c) => row(
      certificateWhen(c),
      `<div class="title">${esc(c.title)}</div>
       ${some(c.description) === null ? '' : `<div class="grade">${esc(c.description as string)}</div>`}`,
    )).join(''))}
    ${lists.map(([title, html]) => section(title, html === '' ? '' : bare(html))).join('')}
  </div>`;
}

/** One column, everything full width. The shape an ATS reads most reliably. */
function stackedBody(f: Frame, cv: CvData): string {
  const all = [
    ...piece('Personal details', personalDetails(f, cv)),
    ...mainPieces(cv),
    ...piece('Skills', cv.skills.length === 0 ? '' : `<div class="two">${plainLines(cv.skills)}</div>`),
    ...piece('Languages', cv.languages.length === 0 ? '' : `<div class="two">${languageRows(cv)}</div>`),
    ...piece('Hobbies', cv.hobbies.length === 0 ? '' : `<div class="two">${dottedLines(cv.hobbies)}</div>`),
    ...piece('Volunteer work', orderExperience(cv.volunteer).map(roleEntry).join('')),
    ...piece('Responsibilities', cv.responsibilities.length === 0
      ? '' : `<div class="two">${dottedLines(cv.responsibilities)}</div>`),
    ...piece('Certificates', cv.certificates.map(certificateEntry).join('')),
  ];
  return `<div class="sheet stack">
    ${cv.photoDataUri === null ? '' : `<img class="photo" src="${cv.photoDataUri}" alt="" style="float:right;margin-left:8mm">`}
    ${nameBar(f, cv)}
    ${all.map(block).join('')}
  </div>`;
}

function body(f: Frame, cv: CvData): string {
  if (f.preset.layout === 'timeline') return timelineBody(f, cv);
  if (f.preset.layout === 'stacked') return stackedBody(f, cv);
  return sidebarBody(f, cv);
}

// ------------------------------------------------------------------ the shell

/** Render the CV as a standalone HTML document. */
export function renderCvHtml(cv: CvData, style: CvStyle = DEFAULT_CV_STYLE): string {
  const f = frame(style);
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${esc(cv.fullName)} — CV</title>
<style>${styles(f)}</style></head>
<body>${body(f, cv)}</body></html>`;
}

/**
 * The same document, wrapped so Word opens it as an editable file.
 *
 * This is HTML that Word understands, not OOXML. It opens and edits correctly
 * in Word, LibreOffice and Google Docs, which is what "download as Word" means
 * to someone applying for a job. A real .docx would need a zip writer and an
 * XML layer for no gain a teacher would notice.
 */
export function renderCvWordHtml(cv: CvData, style: CvStyle = DEFAULT_CV_STYLE): string {
  return renderCvHtml(cv, style).replace(
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
 *
 * The sheet carries its own padding, so the preview adds none of its own.
 */
export function renderCvPreviewHtml(cv: CvData, style: CvStyle = DEFAULT_CV_STYLE): string {
  return renderCvHtml(cv, style).replace(
    '<meta charset="utf-8">',
    `<meta charset="utf-8">` +
    `<meta name="viewport" content="width=${CV_PAGE_WIDTH}, initial-scale=1">` +
    `<style>html { background: #e9e9e9; }` +
    ` body { margin: 0 auto; max-width: ${CV_PAGE_WIDTH}px; min-height: 1123px; }</style>`,
  );
}
