import type { Job, JobRequirement, TeacherProfile } from '@mwalimu/types';

/**
 * Match scoring.
 *
 * The number a teacher sees on a job card, and the number a recruiter sees
 * beside a candidate, MUST come from this function - if the two sides ever
 * disagree, the feature is worse than useless. Keep it pure and dependency-free
 * so it runs unchanged in the mobile app, the web dashboard and an Edge Function.
 */

export type RequirementStatus = 'met' | 'partial' | 'missing';

/** Credit awarded toward the weighted score for each status. */
const CREDIT: Readonly<Record<RequirementStatus, number>> = {
  met: 1,
  partial: 0.5,
  missing: 0,
};

/**
 * A failed must-have caps the score here. The cap sits below every Auto-Apply
 * threshold (`minMatchScore` floors at 50) so a hard gate can never be
 * auto-applied past, whatever else the teacher brings.
 */
export const MUST_HAVE_FAIL_CAP = 49;

export interface RequirementResult {
  readonly kind: JobRequirement['kind'];
  readonly label: string;
  readonly status: RequirementStatus;
  readonly mustHave: boolean;
  /**
   * What to tell the teacher, e.g. "You have 5 years". The UI renders this
   * under the requirement label.
   */
  readonly detail: string;
}

export interface MatchResult {
  /** 0-100, rounded. */
  readonly score: number;
  /** True when a must-have requirement was not met; `score` is capped. */
  readonly blocked: boolean;
  readonly requirements: readonly RequirementResult[];
  readonly metCount: number;
  readonly totalCount: number;
}

/** Case- and spacing-insensitive slug comparison. */
const sameSlug = (a: string, b: string): boolean =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

const has = (list: readonly string[], value: string): boolean =>
  list.some((item) => sameSlug(item, value));

function evaluate(req: JobRequirement, teacher: TeacherProfile): Omit<RequirementResult, 'kind' | 'label' | 'mustHave'> {
  switch (req.kind) {
    case 'subject': {
      const met = has(teacher.subjects, req.value);
      return met
        ? { status: 'met', detail: 'One of your teaching subjects' }
        : { status: 'missing', detail: 'Not on your profile' };
    }

    case 'qualification': {
      // 'degree' is the one qualification we model structurally; anything else
      // is matched against the teacher's declared skills.
      if (sameSlug(req.value, 'degree')) {
        return teacher.hasDegree
          ? { status: 'met', detail: 'Degree on your profile' }
          : { status: 'missing', detail: 'No degree on your profile' };
      }
      return has(teacher.skills, req.value)
        ? { status: 'met', detail: 'Listed in your skills' }
        : { status: 'missing', detail: 'Not on your profile' };
    }

    case 'experience_years': {
      const required = Number.parseInt(req.value, 10);
      if (!Number.isFinite(required)) {
        return { status: 'missing', detail: 'Requirement could not be read' };
      }
      const actual = teacher.experienceYears;
      if (actual >= required) {
        return { status: 'met', detail: `You have ${actual} ${actual === 1 ? 'year' : 'years'}` };
      }
      // Within a year of the bar is worth surfacing rather than hiding - schools
      // routinely interview candidates just under it.
      if (actual >= required - 1) {
        return { status: 'partial', detail: `You have ${actual} of ${required} years` };
      }
      return { status: 'missing', detail: `You have ${actual} of ${required} years` };
    }

    case 'tsc_registration': {
      if (teacher.tscNumber === undefined) {
        return { status: 'missing', detail: 'No TSC number on your profile' };
      }
      return teacher.tscVerified
        ? { status: 'met', detail: `No. ${teacher.tscNumber} — verified` }
        : { status: 'partial', detail: `No. ${teacher.tscNumber} — not yet verified` };
    }

    case 'curriculum': {
      return has(teacher.curricula, req.value)
        ? { status: 'met', detail: 'On your profile' }
        : { status: 'missing', detail: 'Not on your profile — add it?' };
    }

    case 'county': {
      return sameSlug(teacher.county, req.value)
        ? { status: 'met', detail: 'Your county' }
        : { status: 'missing', detail: 'Outside your county' };
    }
  }
}

/**
 * Fallback when a job lists no structured requirements: score on the two things
 * every job has - subject overlap and location. Without this, an unstructured
 * job would divide by zero and read as a 0% match.
 */
function baselineScore(job: Job, teacher: TeacherProfile): MatchResult {
  const subjectHit = job.subjects.some((s) => has(teacher.subjects, s));
  const countyHit = sameSlug(job.county, teacher.county);
  const requirements: RequirementResult[] = [
    {
      kind: 'subject',
      label: 'Subject',
      mustHave: false,
      status: subjectHit ? 'met' : 'missing',
      detail: subjectHit ? 'One of your teaching subjects' : 'Not on your profile',
    },
    {
      kind: 'county',
      label: 'Location',
      mustHave: false,
      status: countyHit ? 'met' : 'missing',
      detail: countyHit ? 'Your county' : 'Outside your county',
    },
  ];
  const metCount = requirements.filter((r) => r.status === 'met').length;
  return {
    score: Math.round((metCount / requirements.length) * 100),
    blocked: false,
    requirements,
    metCount,
    totalCount: requirements.length,
  };
}

/**
 * Score how well `teacher` fits `job`, with a per-requirement breakdown the UI
 * renders row by row.
 */
export function matchScore(job: Job, teacher: TeacherProfile): MatchResult {
  if (job.requirements.length === 0) return baselineScore(job, teacher);

  const requirements: RequirementResult[] = job.requirements.map((req) => {
    const { status, detail } = evaluate(req, teacher);
    return { kind: req.kind, label: req.label, mustHave: req.mustHave, status, detail };
  });

  let earned = 0;
  let possible = 0;
  job.requirements.forEach((req, i) => {
    // Index is in range: `requirements` is mapped 1:1 from `job.requirements`.
    const status = requirements[i]!.status;
    earned += req.weight * CREDIT[status];
    possible += req.weight;
  });

  const blocked = requirements.some((r) => r.mustHave && r.status === 'missing');
  const raw = possible === 0 ? 0 : Math.round((earned / possible) * 100);

  return {
    score: blocked ? Math.min(raw, MUST_HAVE_FAIL_CAP) : raw,
    blocked,
    requirements,
    metCount: requirements.filter((r) => r.status === 'met').length,
    totalCount: requirements.length,
  };
}
