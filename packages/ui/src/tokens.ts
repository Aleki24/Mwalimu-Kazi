import raw from '../tokens.json';

/**
 * Design tokens.
 *
 * The values live in `tokens.json` so that BOTH TypeScript and
 * `tailwind.config.js` (which cannot import TS) read the same file — the
 * alternative is two copies of the palette drifting apart.
 *
 * `muted` is deliberately slate-600 rather than slate-500: at the 10-12px sizes
 * this UI is built from, slate-500 reads washed out. The skulbase web app's
 * globals.css made the same correction.
 */

export interface Palette {
  readonly primary: string;
  readonly primaryDark: string;
  readonly primarySoft: string;
  readonly background: string;
  readonly card: string;
  readonly border: string;
  readonly foreground: string;
  readonly muted: string;
  readonly mutedFaint: string;
  readonly mutedBg: string;
  readonly success: string; readonly successBg: string;
  readonly danger: string;  readonly dangerBg: string;
  readonly warning: string; readonly warningBg: string;
  readonly info: string;    readonly infoBg: string;
}

export interface Scale { readonly xs: number; readonly sm: number; readonly md: number; readonly lg: number; readonly xl: number }
export interface RadiusScale extends Omit<Scale, 'xs'> { readonly pill: number }
export interface Fonts { readonly display: string; readonly body: string; readonly mono: string }

// The annotations are the contract: a key missing from tokens.json fails the build.
export const colors: Palette = raw.colors;
export const spacing: Scale = raw.spacing;
export const radius: RadiusScale = raw.radius;
export const fonts: Fonts = raw.fonts;

/**
 * Minimum tappable size in dp. Anything interactive must meet this — filter
 * chips and icon buttons are the ones that slip below it.
 */
export const HIT_TARGET_MIN = 44;

export type ColorToken = keyof Palette;
