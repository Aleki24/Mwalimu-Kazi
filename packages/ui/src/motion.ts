/**
 * The seven springs, ported from `.claude/skills/oa-design/_motion.md`.
 *
 * The CSS system drives these through the `motion` package; Reanimated takes
 * the same stiffness/damping pair, so the numbers cross over unchanged. Rule
 * four of the skill is that there are seven and no eighth — hence a closed
 * const object rather than a helper that takes arbitrary values.
 */

export interface Spring {
  readonly stiffness: number;
  readonly damping: number;
}

export const SPRING = {
  /** Dropdowns, menus, boards, toggles. */
  PANEL: { stiffness: 550, damping: 38 },
  /** Measured height/width, travelling pills. */
  LAYOUT: { stiffness: 550, damping: 40 },
  /** Modal entrance. */
  POP: { stiffness: 400, damping: 26 },
  /** Modal exit — softer than the entrance on purpose. */
  POP_EXIT: { stiffness: 380, damping: 28 },
  /** Floating pills, page banners. */
  BANNER: { stiffness: 400, damping: 30 },
  /** Icon micro-moves. */
  FLICK: { stiffness: 900, damping: 50 },
  /** Chart tooltips and crosshairs. */
  CHART: { stiffness: 300, damping: 28 },
} as const satisfies Readonly<Record<string, Spring>>;

export type SpringName = keyof typeof SPRING;

/** Micro fades: 0.1s out, 0.16s in. Nothing in app chrome tweens past 0.2s. */
export const FADE = { out: 100, in: 160 } as const;
