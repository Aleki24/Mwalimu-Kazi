import { describe, expect, it } from 'vitest';
import {
  DECISION_STAGES, decisionNeedsDetail, describeDecision, formatInterviewWhen, isDecision,
  nairobiIso,
} from './decision';

const bare = { decisionNote: null, interviewAt: null, interviewPlace: null } as const;

describe('what counts as a decision', () => {
  it('is what the school did, never what the teacher did', () => {
    expect(isDecision('shortlisted')).toBe(true);
    expect(isDecision('rejected')).toBe(true);
    // The three the applicant does themselves.
    expect(isDecision('saved')).toBe(false);
    expect(isDecision('applied')).toBe(false);
    expect(isDecision('withdrawn')).toBe(false);
  });

  it('asks for something before an interview or a rejection', () => {
    expect(decisionNeedsDetail('interview')).toBe(true);
    expect(decisionNeedsDetail('rejected')).toBe(true);
    expect(decisionNeedsDetail('shortlisted')).toBe(false);
  });

  it('has no stage the pipeline does not', () => {
    expect([...DECISION_STAGES].sort()).toEqual(
      ['interview', 'offered', 'rejected', 'shortlisted', 'viewed'],
    );
  });
});

describe('an interview time', () => {
  /*
    The instant below is 06:30 UTC, which is 09:30 in Nairobi. Getting this
    wrong is not a formatting nit: it is the app telling a teacher to turn up
    three hours early.
  */
  it('is read in Nairobi, whatever the device thinks', () => {
    expect(formatInterviewWhen('2026-10-06T06:30:00Z')).toContain('9:30');
    expect(formatInterviewWhen('2026-10-06T06:30:00Z')).toContain('Tuesday');
    expect(formatInterviewWhen('2026-10-06T06:30:00Z')).toContain('October');
  });

  it('says nothing rather than "Invalid Date"', () => {
    expect(formatInterviewWhen('not a date')).toBe('');
  });
});

describe('the line a teacher reads', () => {
  it('is nothing at all before anyone has decided', () => {
    expect(describeDecision({ ...bare, stage: 'applied' })).toBeNull();
    expect(describeDecision({ ...bare, stage: 'viewed' })).toBeNull();
    expect(describeDecision({ ...bare, stage: 'shortlisted' })).toBeNull();
  });

  it('names the day, the time and the place of an interview', () => {
    const line = describeDecision({
      stage: 'interview',
      decisionNote: null,
      interviewAt: '2026-10-06T06:30:00Z',
      interviewPlace: 'At the school',
    });
    expect(line).toContain('Tuesday');
    expect(line).toContain('9:30');
    expect(line).toContain('At the school');
  });

  it('still invites when a school gave a note instead of a time', () => {
    expect(describeDecision({
      stage: 'interview',
      decisionNote: 'We will call you on Monday to fix a time.',
      interviewAt: null,
      interviewPlace: null,
    })).toBe('They would like to meet you. We will call you on Monday to fix a time.');
  });

  it('prefers the school’s own words to the stock sentence', () => {
    expect(describeDecision({
      ...bare, stage: 'rejected', decisionNote: 'The role has been filled.',
    })).toBe('The role has been filled.');
  });

  it('says something plain when a rejection came with nothing', () => {
    expect(describeDecision({ ...bare, stage: 'rejected' }))
      .toBe('They are not taking this one further.');
  });

  it('does not leave whitespace standing in for a reason', () => {
    expect(describeDecision({ ...bare, stage: 'rejected', decisionNote: '   ' }))
      .toBe('They are not taking this one further.');
  });
});

describe('a date and a time typed into a form', () => {
  it('mean the instant they mean in Nairobi', () => {
    // 09:30 in Kenya is 06:30 UTC, all year round.
    expect(nairobiIso('2026-10-06', '09:30')).toBe('2026-10-06T09:30:00+03:00');
    expect(new Date(nairobiIso('2026-10-06', '09:30') ?? '').toISOString())
      .toBe('2026-10-06T06:30:00.000Z');
  });

  it('accept a single-digit hour', () => {
    expect(nairobiIso('2026-10-06', '9:30')).toBe('2026-10-06T09:30:00+03:00');
  });

  it('refuse what they cannot read', () => {
    expect(nairobiIso('6 October', '09:30')).toBeNull();
    expect(nairobiIso('2026-10-06', 'half nine')).toBeNull();
    expect(nairobiIso('2026-10-06', '25:00')).toBeNull();
    expect(nairobiIso('2026-10-06', '09:75')).toBeNull();
  });

  it('refuse a day that does not exist rather than rolling it forward', () => {
    expect(nairobiIso('2026-02-31', '09:30')).toBeNull();
  });
});
