import raw from '../tokens.json';

/**
 * OA Design tokens, ported from `.claude/skills/oa-design/_root.css`.
 *
 * Two deliberate translations, because the source is CSS and this is React
 * Native:
 *
 * 1. `color-mix(in srgb, var(--ink) 12%, transparent)` has no RN equivalent, so
 *    every ink mix is precomputed. `rgba(41,41,41,0.12)` is the same colour the
 *    browser would produce — the percentages ARE the system, so they stay
 *    visible in the names rather than collapsing into opaque greys.
 * 2. Radii are numbers, not rem. The base is 10, matching `--radius: 0.625rem`.
 *
 * The values live in `tokens.json` so the Tailwind config (which cannot import
 * TypeScript) reads the same file.
 */

export interface Palette {
  /** The grey stage between plates. */
  readonly background: string;
  readonly card: string;
  readonly popover: string;
  readonly foreground: string;

  /** Ink at 12% — the only divider in the system. */
  readonly border: string;
  /** Ink at 14% — input outlines. */
  readonly input: string;
  /** Ink at 5% — hover washes and recessed insets. */
  readonly wash: string;
  readonly washStrong: string;
  readonly hairline: string;
  readonly mutedForeground: string;
  /** Flat grey for secondary controls; carries no border. */
  readonly secondary: string;

  /**
   * The one accent. Primary actions and the primary chart line, nothing else.
   *
   * Warm terracotta rather than the brighter orange these palettes usually
   * reach for: #f97316 and #ea580c both fall below 4.5:1 against white, so a
   * button label sitting on them fails AA. This clears it at 5.18:1, which is
   * within a hair of the blue it replaced.
   */
  readonly primary: string;
  readonly primaryForeground: string;
  readonly ring: string;

  /** Semantic colours tint TEXT and small dots. They never fill a surface. */
  readonly destructive: string; readonly destructiveForeground: string;
  readonly success: string; readonly successForeground: string;
  readonly warning: string; readonly warningForeground: string;
  readonly info: string; readonly infoForeground: string;

  readonly chart1: string;
}

export interface RadiusScale {
  readonly sm: number; readonly md: number; readonly lg: number;
  readonly xl: number; readonly xl2: number; readonly xl3: number;
  readonly xl4: number;
  /** Reserved for pills: buttons, tabs, chips, the floating banner. */
  readonly pill: number;
}

export interface Scale { readonly xs: number; readonly sm: number; readonly md: number; readonly lg: number; readonly xl: number }
export interface Fonts { readonly sans: string; readonly mono: string }

export const ink: string = raw.ink;
export const colors: Palette = raw.colors;
export const radius: RadiusScale = raw.radius;
export const spacing: Scale = raw.spacing;
export const fonts: Fonts = raw.fonts;

/**
 * The weight ceiling is the identity: Inter Tight 300–500, no bold anywhere.
 * Hierarchy comes from size, colour and spacing. Exported as a closed set so a
 * screen cannot reach for 700 by habit.
 */
export const weight = {
  light: '300',
  regular: '400',
  medium: '500',
} as const;
export type Weight = (typeof weight)[keyof typeof weight];

/** Two shadows in the whole system: a thing is resting, or it is floating. */
export const shadow = {
  resting: {
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  floating: {
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
} as const;

/**
 * Minimum tappable size in dp. OA does not state one — it is a web system —
 * but a phone needs it, and chips are where it slips.
 */
export const HIT_TARGET_MIN = 44;

export type ColorToken = keyof Palette;
