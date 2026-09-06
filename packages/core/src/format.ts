import type { MatchResult } from './match.js';

/**
 * Presentation helpers shared by the mobile app and the recruiter dashboard.
 *
 * These live in core rather than in either client because a salary or a match
 * band rendered two different ways is a support ticket waiting to happen.
 */

/** Drops a trailing ".0" so 45000 reads "45", not "45.0". */
const inThousands = (n: number): string => {
  const v = n / 1000;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
};

/**
 * Compact salary for a card: "KSh 45–60k", "KSh 40k+", "Salary not stated".
 *
 * The "k" is written once, on the last figure, the way the amount is actually
 * said aloud. Never invents a figure a school did not advertise.
 */
export function formatSalary(band: { min: number; max?: number } | undefined): string {
  if (band === undefined) return 'Salary not stated';
  const full = (n: number): string => n.toLocaleString('en-KE');

  if (band.max === undefined) {
    return band.min >= 1000 ? `KSh ${inThousands(band.min)}k+` : `KSh ${full(band.min)}+`;
  }
  // Only abbreviate when both ends share the unit, so a band like 900-60000 is
  // not rendered as a misleading "0.9-60k".
  return band.min >= 1000
    ? `KSh ${inThousands(band.min)}–${inThousands(band.max)}k`
    : `KSh ${full(band.min)}–${full(band.max)}`;
}

/** Full salary for a detail screen: "KSh 45,000–60,000 per month". */
export function formatSalaryFull(band: { min: number; max?: number } | undefined): string {
  if (band === undefined) return 'Salary not stated';
  const n = (v: number): string => v.toLocaleString('en-KE');
  const range = band.max === undefined ? `${n(band.min)}+` : `${n(band.min)}–${n(band.max)}`;
  return `KSh ${range} per month`;
}

const MINUTE = 60_000, HOUR = 60 * MINUTE, DAY = 24 * HOUR;

/** "just now", "3 min ago", "5h ago", "2d ago", then a date. */
export function formatPostedAge(postedAt: Date, now: Date): string {
  const delta = now.getTime() - postedAt.getTime();
  if (delta < 0) return 'just now';
  if (delta < MINUTE) return 'just now';
  if (delta < HOUR) return `${Math.floor(delta / MINUTE)} min ago`;
  if (delta < DAY) return `${Math.floor(delta / HOUR)}h ago`;
  if (delta < 7 * DAY) return `${Math.floor(delta / DAY)}d ago`;
  return postedAt.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
}

/**
 * Kenya has no daylight saving, so a fixed zone is safe here and keeps
 * "today" meaning the same thing for every teacher in the country.
 */
export const DEFAULT_TIME_ZONE = 'Africa/Nairobi';

/** Days since the epoch for the calendar date `d` falls on in `timeZone`. */
function calendarDay(d: Date, timeZone: string): number {
  // en-CA formats as YYYY-MM-DD, which parses back unambiguously.
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
  return Math.floor(Date.parse(`${ymd}T00:00:00Z`) / DAY);
}

/**
 * Urgency for a closing date. `null` when the role has no deadline - the UI
 * shows nothing rather than inventing a reassurance.
 *
 * "Today" and "tomorrow" are CALENDAR facts, not elapsed-hours arithmetic: a
 * deadline 30 hours away still falls tomorrow, and a teacher told "in 2 days"
 * may plan to apply the day after it shuts.
 */
export function formatClosing(
  closesAt: Date | undefined,
  now: Date,
  timeZone: string = DEFAULT_TIME_ZONE,
): string | null {
  if (closesAt === undefined) return null;
  const delta = closesAt.getTime() - now.getTime();
  if (delta <= 0) return 'Closed';
  if (delta < HOUR) return 'Closes within the hour';

  const days = calendarDay(closesAt, timeZone) - calendarDay(now, timeZone);
  if (days <= 0) return 'Closes today';
  if (days === 1) return 'Closes tomorrow';
  return `Closes in ${days} days`;
}

export type MatchBand = 'strong' | 'good' | 'partial' | 'weak';

/**
 * Band a score for colour and wording. Thresholds are shared so a job card and
 * a candidate row never disagree about what "strong" means.
 */
export function matchBand(score: number): MatchBand {
  if (score >= 90) return 'strong';
  if (score >= 75) return 'good';
  if (score >= 60) return 'partial';
  return 'weak';
}

export const MATCH_BAND_LABEL: Readonly<Record<MatchBand, string>> = {
  strong: 'Strong match',
  good: 'Good match',
  partial: 'Partial match',
  weak: 'Weak match',
};

/**
 * The sentence under the score on a job detail screen. When a must-have is
 * unmet it says so plainly instead of dressing up a capped number.
 */
export function explainMatch(match: MatchResult): string {
  if (match.blocked) {
    const missing = match.requirements.find((r) => r.mustHave && r.status === 'missing');
    return missing === undefined
      ? 'You do not meet a required qualification for this role.'
      : `This role requires ${missing.label.toLowerCase()}, which is not on your profile.`;
  }
  const { metCount, totalCount } = match;
  if (metCount === totalCount) return `You meet all ${totalCount} listed requirements.`;
  return `You meet ${metCount} of ${totalCount} listed requirements.`;
}
