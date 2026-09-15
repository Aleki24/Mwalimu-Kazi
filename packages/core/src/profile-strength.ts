import type { TeacherProfile } from '@mwalimu/types';

/**
 * How complete a teacher's profile is, and what to fix next.
 *
 * Weighted by what actually changes outcomes rather than by field count. A TSC
 * number is worth more than a headline because `matchScore` treats TSC
 * registration as a hard gate — a teacher without one is excluded outright from
 * the roles that require it, and no amount of biography compensates.
 *
 * Every item is something the teacher can act on from a screen that exists. A
 * completeness score that scolds you about a field you cannot reach is just a
 * worse way of saying "no".
 */

/**
 * Which screen fixes an item.
 *
 * Named rather than given as a route: this package knows nothing about the
 * app's navigator, and a string path here would be a link that compiles
 * happily after the screen it points at has been renamed. The app maps these
 * two words onto its own typed routes.
 *
 * It exists because the dashboard sent every unfinished item to the CV
 * editor — including "Add your TSC number", which cannot be set there. Being
 * told to fix something on a screen that cannot fix it is worse than not
 * being told.
 */
export type StrengthTarget = 'profile' | 'cv';

export interface StrengthItem {
  readonly label: string;
  readonly weight: number;
  readonly done: boolean;
  readonly where: StrengthTarget;
}

export interface ProfileStrength {
  /** 0–100, rounded. */
  readonly percent: number;
  /** Unfinished items, heaviest first — the order to fix them in. */
  readonly missing: readonly StrengthItem[];
}

/** Anything the CV screen owns; passed in so this stays a pure function. */
export interface CvCompleteness {
  readonly hasSummary: boolean;
  readonly experienceCount: number;
  readonly educationCount: number;
  readonly refereeCount: number;
}

export function profileStrength(
  teacher: TeacherProfile,
  cv: CvCompleteness,
): ProfileStrength {
  const items: readonly StrengthItem[] = [
    // The matcher's hard gate. Nothing else moves as many roles into reach.
    { label: 'Add your TSC number', weight: 20, done: teacher.tscNumber !== undefined, where: 'profile' },
    { label: 'List the subjects you teach', weight: 15, done: teacher.subjects.length > 0, where: 'profile' },
    { label: 'Add work experience to your CV', weight: 15, done: cv.experienceCount > 0, where: 'cv' },
    { label: 'Add your qualifications', weight: 15, done: cv.educationCount > 0, where: 'cv' },
    { label: 'Write a short personal statement', weight: 10, done: cv.hasSummary, where: 'cv' },
    { label: 'Add a referee', weight: 10, done: cv.refereeCount > 0, where: 'cv' },
    { label: 'Say which curricula you know', weight: 8, done: teacher.curricula.length > 0, where: 'profile' },
    { label: 'Add a headline', weight: 7, done: (teacher.headline ?? '').trim() !== '', where: 'profile' },
  ];

  const total = items.reduce((sum, i) => sum + i.weight, 0);
  const earned = items.reduce((sum, i) => sum + (i.done ? i.weight : 0), 0);

  return {
    percent: Math.round((earned / total) * 100),
    missing: items.filter((i) => !i.done).sort((a, b) => b.weight - a.weight),
  };
}
