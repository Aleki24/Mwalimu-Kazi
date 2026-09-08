import raw from '../tokens.json';

/**
 * The Mwalimu Kazi token set.
 *
 * Three rules hold the visual system together, and every value below exists to
 * serve one of them:
 *
 * 1. **Indigo is the brand.** `primary` carries hero cards, primary CTAs, the
 *    active tab and progress rings. It is the only colour that fills a large
 *    surface.
 * 2. **Coral is only ever urgency.** A deadline that is about to bite, a
 *    closed listing, a rejection. Spending it anywhere else is what makes an
 *    app feel like it is shouting, so `urgent` and `destructive` are the same
 *    hue on purpose — they are the same message.
 * 3. **Charcoal ink on a grey canvas.** White plates float on `background`;
 *    the gap between plates is the divider, so there are no rules.
 *
 * Two translations, because a design brief is written for a browser and this is
 * React Native:
 *
 * - `color-mix(in srgb, var(--ink) 10%, transparent)` has no RN equivalent, so
 *   every ink mix is precomputed. `rgba(26,26,26,0.10)` is the colour a browser
 *   would produce, and the percentages stay visible in the names rather than
 *   collapsing into opaque greys.
 * - Radii are numbers, not rem. `radius.xl2` is the 16 the brief specifies for
 *   cards; everything else nests inside or around it.
 *
 * The values live in `tokens.json` so the Tailwind config — which cannot import
 * TypeScript — reads the same file, and the two cannot drift apart.
 */

/**
 * Every semantic colour comes as a triple, and the split is a contrast
 * requirement rather than a stylistic one.
 *
 * Coral at #E85D3D scores 3.46:1 against white — in either direction. A coral
 * chip with white text and coral small text on a card both fail WCAG AA, so
 * the brand coral is a *fill and dot* colour, `…Foreground` is its darker text
 * partner (5.98:1), and `…Surface` is the tint the two sit on together
 * (5.26:1). Green and amber fail the same way and are split the same way.
 * Indigo is the exception: 11.5:1 both ways, which is why it can be a filled
 * surface and a text colour at once.
 */
export interface SemanticTriple {
  /** Fills a chip, a dot, an icon. Never small text. */
  readonly fill: string;
  /** Text and icons on white or on the matching surface. */
  readonly text: string;
  /** The tint a filled chip sits on. */
  readonly surface: string;
}

export interface Palette {
  /** The grey stage the white plates float on. */
  readonly background: string;
  readonly card: string;
  readonly popover: string;
  /** Charcoal. Headings and body. */
  readonly foreground: string;

  /** Ink at 10% — the only divider in the system. */
  readonly border: string;
  /** Ink at 14% — input outlines. */
  readonly input: string;
  /** Ink at 4% — hover washes and recessed insets. */
  readonly wash: string;
  readonly washStrong: string;
  readonly hairline: string;
  /** Metadata: dates, counties, salary lines, captions. */
  readonly mutedForeground: string;
  /** Unmet requirements, fully-booked slots, disabled controls. */
  readonly disabledForeground: string;
  /** Flat grey for secondary controls; carries no border. */
  readonly secondary: string;

  /** Deep indigo. Hero cards, primary CTAs, active nav, progress rings. */
  readonly primary: string;
  readonly primaryForeground: string;
  /** Indigo at a tint, for selected chips and quiet indigo chrome. */
  readonly primarySurface: string;
  readonly ring: string;

  /** The two ends of the hero gradient — the only gradient in the app. */
  readonly heroFrom: string;
  readonly heroTo: string;

  /** Warm coral. Deadlines and nothing else. See the note on SemanticTriple. */
  readonly urgent: string;
  readonly urgentForeground: string;
  readonly urgentSurface: string;

  /** Closed and rejected — the same coral, because it is the same message. */
  readonly destructive: string;
  readonly destructiveForeground: string;
  readonly destructiveSurface: string;
  /** Offer, Hired, a met requirement. */
  readonly success: string;
  readonly successForeground: string;
  readonly successSurface: string;
  /** Under review. */
  readonly warning: string;
  readonly warningForeground: string;
  readonly warningSurface: string;
  readonly info: string;
  readonly infoForeground: string;
  readonly infoSurface: string;

  readonly chart1: string;
}

export interface RadiusScale {
  readonly sm: number; readonly md: number; readonly lg: number;
  readonly xl: number;
  /** 16 — the card radius. Cards, hero cards, sheets, upload rows. */
  readonly xl2: number;
  readonly xl3: number; readonly xl4: number;
  /** Reserved for pills: buttons, tabs, chips, the floating bar. */
  readonly pill: number;
}

export interface Scale { readonly xs: number; readonly sm: number; readonly md: number; readonly lg: number; readonly xl: number }
export interface Fonts { readonly sans: string; readonly mono: string }

export const ink: string = raw.ink;
export const colors: Palette = raw.colors;
export const radius: RadiusScale = raw.radius;
export const spacing: Scale = raw.spacing;
export const fonts: Fonts = raw.fonts;

/** The card radius, named. `radius.xl2` and this are deliberately the same 16. */
export const CARD_RADIUS: number = raw.radius.xl2;

/**
 * The status vocabulary, closed. A tone that is not in here has no colour,
 * which is the point: adding an eighth should be a decision, not a side effect
 * of one screen needing one. Every consumer reads the triple from here, so a
 * badge and a dot for the same state can never disagree.
 */
export const STATUS = {
  /** No colour spent. Ordinary metadata that happens to sit in a badge. */
  neutral: { fill: colors.mutedForeground, text: colors.mutedForeground, surface: colors.wash },
  /** Indigo. In progress, active, selected — the brand doing brand work. */
  primary: { fill: colors.primary, text: colors.primary, surface: colors.primarySurface },
  /** Green. Offer, Hired, a requirement the teacher already meets. */
  success: { fill: colors.success, text: colors.successForeground, surface: colors.successSurface },
  /** Amber. Under review, shortlisted — waiting on someone else. */
  warning: { fill: colors.warning, text: colors.warningForeground, surface: colors.warningSurface },
  /** Coral. Closed, rejected, withdrawn. */
  danger: { fill: colors.destructive, text: colors.destructiveForeground, surface: colors.destructiveSurface },
  /** Coral again, and deliberately so: a deadline about to bite reads as the
   *  same alarm as a rejection. Named apart from `danger` because the two mean
   *  different things and a screen should have to say which it means. */
  urgent: { fill: colors.urgent, text: colors.urgentForeground, surface: colors.urgentSurface },
  info: { fill: colors.info, text: colors.infoForeground, surface: colors.infoSurface },
} as const satisfies Readonly<Record<string, SemanticTriple>>;

export type StatusTone = keyof typeof STATUS;

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

/**
 * Two shadows in the whole system: a thing is resting, or it is floating.
 * Both are soft and diffuse — wide radius at low opacity — so a card reads as
 * lifted off the canvas rather than outlined by a hard drop.
 */
export const shadow = {
  resting: {
    shadowColor: '#0f172a', shadowOpacity: 0.05, shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  floating: {
    shadowColor: '#0f172a', shadowOpacity: 0.10, shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
} as const;

/**
 * Minimum tappable size in dp. A phone needs one, and chips are where it slips.
 */
export const HIT_TARGET_MIN = 44;

export type ColorToken = keyof Palette;
