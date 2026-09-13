import type { ApplicationStage } from '@mwalimu/types';

/**
 * What a school says when it moves somebody along, and how it reads.
 *
 * The pipeline used to be six words and nothing else. A teacher was
 * shortlisted, interviewed or rejected and the only trace was a label on a
 * screen they had to think to reopen. Two things were missing and both are
 * here: something to say, and a way to say it that reads like a person wrote
 * it rather than a status field.
 *
 * The wording is deliberately plain and deliberately Kenyan-market: a teacher
 * who has applied to forty schools and heard back from none is the user this
 * exists for, and "your application was unsuccessful at this time" is the
 * register that made them stop reading.
 */

/**
 * Reasons a recruiter can tap rather than type.
 *
 * Every one of them is a real reason a Kenyan school turns somebody down, and
 * every one is something the teacher can do something with — which is the test
 * for being on this list. "Not a good fit" is not here, because it tells the
 * reader nothing and costs the writer nothing.
 *
 * They are suggestions, not a closed set: the field underneath takes anything,
 * and a school that wants to say something kinder or more specific should.
 */
export const REJECTION_REASONS: readonly string[] = [
  'We have gone with someone who already teaches this syllabus.',
  'We needed more classroom years than your profile shows.',
  'The subject combination was not quite what we advertised.',
  'The role has been filled.',
  'We are pausing this vacancy for now.',
  'Your TSC registration was not in order for this post.',
];

/**
 * The same list for a household rather than a school.
 *
 * A parent turning a tutor down is not turning down a job application, and
 * "your TSC registration was not in order for this post" is a sentence no
 * parent has ever said. Same card, same sheet, different words — which is why
 * the card already carries a `verb` to tell the two apart.
 */
export const REJECTION_REASONS_TUITION: readonly string[] = [
  'We have found someone closer to us.',
  'The times we need did not work out.',
  'The rate is more than we can manage.',
  'We have decided to hold off for now.',
  'We were after a different subject in the end.',
];

/** Things a first interview actually is, offered as one tap each. */
export const INTERVIEW_PLACES: readonly string[] = [
  'At the school',
  'Over a phone call',
  'Online — a link will follow',
];

/**
 * A stage that is a decision, rather than a step the applicant took.
 *
 * `saved` and `applied` are the teacher's own doing and `withdrawn` is them
 * leaving; the rest is the school answering, which is the only thing worth
 * telling somebody about.
 */
export const DECISION_STAGES: readonly ApplicationStage[] = [
  'viewed', 'shortlisted', 'interview', 'offered', 'rejected',
];

export function isDecision(stage: ApplicationStage): boolean {
  return DECISION_STAGES.includes(stage);
}

/**
 * Stages where the recruiter is asked for something before it is sent.
 *
 * A type guard rather than a boolean so the screen that opens the sheet gets
 * the narrowed stage for free, instead of repeating the same two literals to
 * satisfy the compiler and then drifting from this list.
 */
export function decisionNeedsDetail(
  stage: ApplicationStage,
): stage is 'interview' | 'rejected' {
  return stage === 'interview' || stage === 'rejected';
}

/**
 * An interview time as the person reading it will think of it.
 *
 * Africa/Nairobi, always. The database formats the same instant the same way
 * for the notification body, and the two must not disagree — a teacher who
 * reads "9:30am" in their notifications and "6:30am" on the screen has been
 * told the wrong time by the app that invited them.
 */
export function formatInterviewWhen(iso: string, locale = 'en-KE'): string {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return '';
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long', day: 'numeric', month: 'long',
    hour: 'numeric', minute: '2-digit', hour12: true,
    timeZone: 'Africa/Nairobi',
  }).format(when).replace(' at ', ', ');
}

export interface DecisionRecord {
  readonly stage: ApplicationStage;
  readonly decisionNote: string | null;
  readonly interviewAt: string | null;
  readonly interviewPlace: string | null;
}

/**
 * The line a teacher reads under their application.
 *
 * Returns null when there is nothing to say, so a caller can render nothing
 * rather than an empty box — the stages before a decision are the common case
 * and they should look untouched, not blank.
 */
export function describeDecision(record: DecisionRecord): string | null {
  const note = record.decisionNote === null ? '' : record.decisionNote.trim();

  if (record.stage === 'interview') {
    const when = record.interviewAt === null ? null : formatInterviewWhen(record.interviewAt);
    const place = record.interviewPlace === null ? '' : record.interviewPlace.trim();
    const head = when === null || when === ''
      ? 'They would like to meet you.'
      : `They would like to meet you on ${when}${place === '' ? '' : `, ${place}`}.`;
    return note === '' ? head : `${head} ${note}`;
  }

  if (note !== '') return note;
  if (record.stage === 'rejected') return 'They are not taking this one further.';
  if (record.stage === 'offered') return 'They have offered you the role.';
  return null;
}

/**
 * A date and a time as typed, turned into the instant they mean in Kenya.
 *
 * There is no cross-platform date picker in this app and adding one to ask a
 * head of department for a Tuesday morning would be a dependency for a
 * two-field question. So the form takes `2026-10-06` and `09:30`, and this
 * turns them into an instant — with a fixed +03:00, because Kenya has never
 * observed daylight saving and the offset is a constant rather than something
 * to look up.
 *
 * Returns null for anything it cannot read, so the caller can keep the button
 * disabled instead of sending an invitation to the epoch.
 */
export function nairobiIso(date: string, time: string): string | null {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  const clock = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (day === null || clock === null) return null;

  const hour = Number(clock[1]);
  const minute = Number(clock[2]);
  if (hour > 23 || minute > 59) return null;

  const iso = `${day[1]}-${day[2]}-${day[3]}T${String(hour).padStart(2, '0')}:${clock[2]}:00+03:00`;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;

  // `new Date` rolls 2026-02-31 forward to March rather than refusing it, so
  // the only way to catch a day that does not exist is to look at what came
  // back. A school typing a date that silently becomes a different one is
  // worse than a disabled button.
  const back = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Africa/Nairobi',
  }).format(parsed);
  return back === `${day[1]}-${day[2]}-${day[3]}` ? iso : null;
}
