import type { CvSectionKey } from './cv';
import type { CvCompleteness } from './profile-strength';

/**
 * How far a CV has got, and what to write next.
 *
 * The editor presented its nine folds as nine equal rows. That is a filing
 * cabinet, not a task: nothing on the page said which parts a school actually
 * reads, which were already done, or what to do next — so a teacher who opened
 * it saw a form and closed it again.
 *
 * This is the model that was missing. One weighted checklist, derived from
 * counts the screen already holds, so the editor, the profile row and the
 * dashboard can never disagree about how complete a CV is.
 *
 * Every step but the photograph is a section of the document, named by the
 * same key. That is deliberate: the editor puts one card on each section of
 * the CV, so there is no second list of "sections" to keep in step with the
 * first, and the fold you fill in is the block that prints.
 *
 * The weights are not a field count. They are the order a Kenyan head teacher
 * reads in: employment and qualifications first, then a way to reach you, then
 * referees — a shortlisted teacher gets rung up about — and the decoration
 * last. A photograph is worth something on a Kenyan CV, and is still worth
 * less than one line of experience.
 */

/** The parts of a CV that carry weight, in the order the editor asks. */
export const CV_STEP_IDS = [
  'personal', 'photo', 'profile', 'employment', 'education',
  'certificates', 'skills', 'languages', 'volunteer', 'referees',
] as const;

export type CvStepId = (typeof CV_STEP_IDS)[number];

/**
 * Whether a section of the document has a step of its own.
 *
 * Hobbies, positions of responsibility and the subject list are sections a
 * teacher can write and reorder, but nothing is owed on them, so they carry no
 * weight and no nagging.
 */
export function isCvStep(key: CvSectionKey): key is CvSectionKey & CvStepId {
  return (CV_STEP_IDS as readonly string[]).includes(key);
}

interface CvStepDefinition {
  /** The app's own word for it, before a teacher renames the section. */
  readonly label: string;
  /** What this part does for the teacher, in one line they can act on. */
  readonly why: string;
  /** The words on the row that fixes it. */
  readonly action: string;
  /** Share of the total, out of 100 across every step. */
  readonly weight: number;
  /**
   * Whether a CV without it should be sent at all.
   *
   * The difference matters: missing essentials are counted out loud and hold
   * back "ready to send", while the rest are offered as improvements. An app
   * that nags equally about a referee and a hobby has taught you to ignore it
   * about both.
   */
  readonly essential: boolean;
}

const STEPS = {
  personal: {
    label: 'Personal details',
    why: 'A school that wants to interview you has to be able to reach you today.',
    action: 'Add a phone number or email',
    weight: 14,
    essential: true,
  },
  photo: {
    label: 'Photograph',
    why: 'Kenyan employers expect a head-and-shoulders photograph on a CV, and notice when there is none.',
    action: 'Add a photograph',
    weight: 5,
    essential: false,
  },
  profile: {
    label: 'Profile',
    why: 'Two or three sentences at the top of the page: what you teach, for how long, and what you are looking for.',
    action: 'Write a short profile',
    weight: 12,
    essential: true,
  },
  employment: {
    label: 'Employment',
    why: 'The first thing a head teacher reads. Your most recent role does most of the work.',
    action: 'Add a role',
    weight: 20,
    essential: true,
  },
  education: {
    label: 'Education',
    why: 'Almost every advertised role states a minimum qualification, and this is where it is checked.',
    action: 'Add a qualification',
    weight: 18,
    essential: true,
  },
  certificates: {
    label: 'Certificates',
    why: 'Short courses — computer packages, first aid, a curriculum training — separate two teachers with the same degree.',
    action: 'Add a certificate',
    weight: 6,
    essential: false,
  },
  skills: {
    label: 'Skills',
    why: 'Your skills are read by the matcher as well as by a person, so what you list here changes which roles find you.',
    action: 'Add a skill',
    weight: 8,
    essential: false,
  },
  languages: {
    label: 'Languages',
    why: 'Worth stating plainly on a CV read in a country where most classrooms run in two.',
    action: 'Add a language',
    weight: 3,
    essential: false,
  },
  volunteer: {
    label: 'Volunteer work',
    why: 'Worth adding early in a career, when it is the clearest evidence of what you can already do.',
    action: 'Add volunteer work',
    weight: 2,
    essential: false,
  },
  referees: {
    label: 'Referees',
    why: 'A school that shortlists you rings a referee. Without one the decision stalls with you.',
    action: 'Add a referee',
    weight: 12,
    essential: true,
  },
} as const satisfies Readonly<Record<CvStepId, CvStepDefinition>>;

export interface CvStep extends CvStepDefinition {
  readonly id: CvStepId;
  readonly done: boolean;
  /**
   * How many entries this step holds. Zero or one for the steps that are a
   * single answer rather than a list, so a caller can say "3 roles" without
   * knowing which kind of step it is looking at.
   */
  readonly count: number;
}

export interface CvReadiness {
  /** 0–100, weighted. Not a field count. */
  readonly percent: number;
  /** Every step, in the order the editor asks for them. */
  readonly steps: readonly CvStep[];
  /** The same steps by id, for a screen that knows which one it is drawing. */
  readonly byId: Readonly<Record<CvStepId, CvStep>>;
  /** What is still empty, heaviest first — the order to fix it in. */
  readonly missing: readonly CvStep[];
  /** The one to do now: the heaviest unfinished essential, else the heaviest unfinished extra. */
  readonly next: CvStep | null;
  /** Every essential step done. The gate for "this can be sent to a school". */
  readonly ready: boolean;
  readonly essentialsLeft: number;
  /** One line stating where the CV stands, for the top of the editor. */
  readonly summary: string;
}

/**
 * Everything the checklist needs to know, and nothing that requires a network
 * call to find out.
 *
 * It extends `CvCompleteness` rather than restating it so that one fetch feeds
 * both this and `profileStrength` — the two were always describing the same
 * CV, and only stayed consistent by coincidence.
 */
export interface CvFacts extends CvCompleteness {
  /** A phone number or an email. Either is enough to be rung or written to. */
  readonly hasContact: boolean;
  readonly certificateCount: number;
  readonly skillCount: number;
  readonly languageCount: number;
  readonly volunteerCount: number;
  readonly hasPhoto: boolean;
}

export const EMPTY_CV_FACTS: CvFacts = {
  hasContact: false,
  hasSummary: false,
  experienceCount: 0,
  educationCount: 0,
  refereeCount: 0,
  certificateCount: 0,
  skillCount: 0,
  languageCount: 0,
  volunteerCount: 0,
  hasPhoto: false,
};

/** How many entries each step holds, given the facts. */
function countsFor(facts: CvFacts): Readonly<Record<CvStepId, number>> {
  const one = (yes: boolean): number => (yes ? 1 : 0);
  return {
    personal: one(facts.hasContact),
    photo: one(facts.hasPhoto),
    profile: one(facts.hasSummary),
    employment: facts.experienceCount,
    education: facts.educationCount,
    certificates: facts.certificateCount,
    skills: facts.skillCount,
    languages: facts.languageCount,
    volunteer: facts.volunteerCount,
    referees: facts.refereeCount,
  };
}

export function cvReadiness(facts: CvFacts): CvReadiness {
  const counts = countsFor(facts);

  const steps: readonly CvStep[] = CV_STEP_IDS.map((id) => ({
    ...STEPS[id],
    id,
    count: counts[id],
    done: counts[id] > 0,
  }));

  const byId = Object.fromEntries(steps.map((s) => [s.id, s])) as Record<CvStepId, CvStep>;

  const total = steps.reduce((sum, s) => sum + s.weight, 0);
  const earned = steps.reduce((sum, s) => sum + (s.done ? s.weight : 0), 0);

  const missing = steps.filter((s) => !s.done).sort((a, b) => b.weight - a.weight);
  const essentialsLeft = missing.filter((s) => s.essential).length;
  // Essentials first whatever they weigh: what a CV is missing before it can
  // be sent outranks what would merely improve it.
  const next = missing.find((s) => s.essential) ?? missing[0] ?? null;

  return {
    percent: Math.round((earned / total) * 100),
    steps,
    byId,
    missing,
    next,
    ready: essentialsLeft === 0,
    essentialsLeft,
    summary: summarise(essentialsLeft, missing.length),
  };
}

/**
 * The line at the top of the editor.
 *
 * It says what is true rather than congratulating anyone: a CV missing two
 * essentials is not "80% there", it is a document that should not be sent yet.
 */
function summarise(essentialsLeft: number, missingCount: number): string {
  if (essentialsLeft > 0) {
    return essentialsLeft === 1
      ? 'One more thing before this is ready to send.'
      : `${essentialsLeft} things left before this is ready to send.`;
  }
  if (missingCount === 0) return 'Complete. Every section has something in it.';
  return missingCount === 1
    ? 'Ready to send. One optional section is still empty.'
    : `Ready to send. ${missingCount} optional sections are still empty.`;
}
