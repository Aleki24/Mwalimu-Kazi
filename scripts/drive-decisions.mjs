/**
 * A school decides something, and the teacher finds out.
 *
 * Before this, moving somebody through the pipeline changed a word on the
 * recruiter's own screen and did nothing else — no message, no reason, no
 * time, nothing in the applicant's notifications. Six stages that only the
 * school could see. So most of what is asserted below is about the other end
 * of each action: not that the recruiter could press the button, but that the
 * person it was about was told, in words they can act on.
 *
 * Also here: withdrawing, which the stage enum has always had and no policy
 * ever allowed; and a school asking to be checked, which the moderator's queue
 * has always read and nothing could ever write.
 *
 * See scripts/drive-harness.mjs for how to run it.
 */
import { startHarness } from './drive-harness.mjs';

const { check, signIn, text, type, visit, finish } = await startHarness({ port: 4800 });

const SCHOOL = 'Fixture Valley School';
const ROLE = 'Mathematics Teacher — Form 3';
const REASON = 'The role has been filled.';

const press = async (page, name, wait = 2_500) => {
  await page.getByText(name, { exact: true }).first().click();
  await page.waitForTimeout(wait);
};

/** Open the applicant list for the fixture role, whatever stage it is at. */
async function applicants(page) {
  await visit(page, '/recruiter', 5_000);
  await press(page, SCHOOL, 5_000);
  return text(page);
}

/** Expand the stage row on the first applicant card. */
async function openStages(page) {
  await page.getByText(/^(Applied|Viewed|Shortlisted|Interview|Offered|Rejected|Withdrawn)$/)
    .first().click();
  await page.waitForTimeout(1_200);
}

// ------------------------------------------------------ inviting to interview
const recruiter = await signIn('recruiter');
const list = await applicants(recruiter);
check('the recruiter reaches the applicants for their role', list.includes(ROLE));
check('and sees who answered', list.includes('Grace Achieng'));

await openStages(recruiter);
await press(recruiter, 'Interview', 1_500);
const sheet = await text(recruiter);
check('choosing Interview asks for a time rather than sending', sheet.includes('Ask Grace in'));
check('and says which clock it means', /Kenyan time|09:30/.test(sheet));

await type(recruiter, '2026-10-06', '2026-11-10');
await type(recruiter, '09:30', '10:15');
await recruiter.waitForTimeout(800);
const echoed = await text(recruiter);
check('the form reads the time back in words before it is sent',
  echoed.includes('They will be told') && echoed.includes('10:15'));

await press(recruiter, 'At the school', 800);
await press(recruiter, 'Invite Grace', 4_000);
const invited = await text(recruiter);
check('and the card remembers what was said', invited.includes('You told them'));
check('including where', invited.includes('At the school'));

// ---------------------------------------------------- and the teacher is told
const teacher = await signIn('teacher');
const mine = await visit(teacher, '/applications', 6_000);
check('the teacher is shown the invitation, not just the word Interview',
  mine.includes('would like to meet you'));
check('with the day and the time', mine.includes('November') && mine.includes('10:15'));

const inbox = await visit(teacher, '/notifications', 6_000);
check('and it reached their notifications',
  inbox.includes('invited to an interview'));

// --------------------------------------------------- turning somebody down
await applicants(recruiter);
await openStages(recruiter);
await press(recruiter, 'Rejected', 1_500);
const why = await text(recruiter);
check('choosing Rejected asks for a reason', why.includes('Tell Grace why'));
check('and offers words rather than an empty box', why.includes(REASON));
check('while still allowing none, and saying so',
  why.includes('Send with no reason'));

await press(recruiter, REASON, 800);
await press(recruiter, 'Tell Grace', 4_000);
check('the reason is kept with the application',
  (await text(recruiter)).includes('You told them'));

const told = await visit(teacher, '/applications', 6_000);
check('the teacher reads the reason, not just "Rejected"', told.includes(REASON));
check('and a rejected application offers no Withdraw', !told.includes('Withdraw'));
check('the rejection reached their notifications',
  (await visit(teacher, '/notifications', 6_000)).includes('Not this time'));

// ------------------------------------------------------- and can walk away
await applicants(recruiter);
await openStages(recruiter);
await press(recruiter, 'Applied', 3_500);

const live = await visit(teacher, '/applications', 6_000);
check('a live application can be withdrawn', live.includes('Withdraw'));
await press(teacher, 'Withdraw', 4_000);
check('and says so afterwards', (await text(teacher)).includes('Withdrawn'));

// Leave the fixture where the seed put it.
await applicants(recruiter);
await openStages(recruiter);
await press(recruiter, 'Shortlisted', 3_500);

// ------------------------------------------------- a school asks to be checked
await visit(recruiter, '/recruiter', 5_000);
await press(recruiter, 'Fixture Hill School', 5_000);
const hill = await text(recruiter);

if (hill.includes('Ask to be verified')) {
  check('an unverified school is told what that costs it',
    hill.includes('This school is not verified'));
  await press(recruiter, 'Ask to be verified', 5_000);
}
const asked = await text(recruiter);
check('asking puts it in front of a moderator',
  asked.includes('You have asked to be verified'));
check('and never verifies it on the spot', !asked.includes('Verified school'));

const moderator = await signIn('admin');
const queue = await visit(moderator, '/admin', 8_000);
check('the moderator sees the school that asked', queue.includes('Fixture Hill School'));

await finish();
