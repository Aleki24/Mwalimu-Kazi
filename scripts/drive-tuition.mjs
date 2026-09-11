/**
 * A parent asks for a tutor, a teacher answers, and the two of them talk.
 *
 * The whole point of the tuition side is that a household can say what it
 * needs without saying where it lives. Most of the assertions below are about
 * that: the area is shown, the address is not (there is no column for one),
 * the CTA names a person rather than a company, and the notification the
 * teacher gets says "Mary Wambui" and not "A school".
 *
 * See scripts/drive-harness.mjs for how to run it. The listing it reads is the
 * fixture request in supabase/fixtures/dev-seed.sql. It is re-runnable: on a
 * second pass the teacher has already answered, so the CTA reads "In touch"
 * and the answering step is skipped rather than failing.
 */
import { startHarness } from './drive-harness.mjs';

const REQUEST = '00000000-0000-4000-8000-0000000000ff';
const { check, signIn, text, visit, finish } = await startHarness({ port: 4400 });

// ------------------------------------------------------- the teacher finds it
const teacher = await signIn('teacher');
const jobs = await visit(teacher, '/jobs', 5_000);
check('the request appears among the jobs', jobs.includes('tutor for Form 2'));
check('an hourly rate is not shown as a salary', /900–1,200\/hr|KSh 900/.test(jobs));

const tab = async (name) => {
  await teacher.getByRole('button', { name, exact: true }).first().click();
  await teacher.waitForTimeout(2_500);
  const body = await text(teacher);
  await teacher.getByRole('button', { name, exact: true }).first().click();
  await teacher.waitForTimeout(1_200);
  return body;
};

const tuition = await tab('Tuition & homeschool');
check('the tuition tab keeps the request', tuition.includes('tutor for Form 2'));
check('the tuition tab drops school vacancies', !tuition.includes('Chemistry Teacher'));

const online = await tab('Online');
check('the Online tab keeps what can be done online', online.includes('tutor for Form 2'));
check('the Online tab drops school vacancies', !online.includes('Chemistry Teacher'));

// ------------------------------------------------------------- and reads it
const detail = await visit(teacher, `/job/${REQUEST}`, 5_500);
check('detail names it private tuition', detail.includes('Private tuition'));
check(
  'the header calls it a household, not an independent listing',
  detail.includes('A private household') && !detail.includes('Independent listing'),
);
check('only one safety notice', (detail.match(/Never pay a fee/g) ?? []).length === 1);
check(
  'detail shows area, learner and frequency',
  detail.includes('Kilimani') && detail.includes('Form 2') && detail.includes('2 times a week'),
);
check('detail says per hour, not per month', detail.includes('per hour') && !detail.includes('per month'));
check('detail warns it is an unverified household', detail.includes('private household'));
check('detail withholds the address', detail.includes('area rather than the address'));
check('detail shows the level', detail.includes('Expert'));
check('detail names who is asking and what they are', detail.includes('Mary Wambui (Parent)'));
check('detail states the commitment', detail.includes('Part-time') || detail.includes('Part time'));
check('detail states the teacher preference', detail.includes('Female teacher'));
check('detail states the locality preference', detail.includes('Nairobi'));
check(
  'detail says what is available',
  detail.includes('Available online') && detail.includes('Home tutoring'),
);
check(
  'detail says what is not',
  detail.includes('cannot travel') || detail.includes('Not available'),
);
/*
  The claim is that a household's request never borrows employment language.
  Which of the two it shows depends on whether this teacher has answered it
  before, and on a rerun that is "In touch" — so the assertion is on what it
  must never say, plus the right one of the two.
*/
check('the CTA never says "Apply" on a request', !detail.includes('Apply now'));
const fresh = detail.includes('Contact Mary');
check('the CTA names the person, or says they are already in touch',
  fresh || detail.includes('In touch'));
check('no school reputation block on a request', !detail.includes('What teachers said'));
// Public questions under a household's request would be a thread of named
// teachers narrowing down where a family lives.
check('no public comment thread on a household request', !detail.includes('Comments'));

// --------------------------------------------------------- the teacher answers
if (fresh) {
  await teacher.getByRole('button', { name: /Contact Mary/ }).first().click();
  await teacher.waitForTimeout(5_000);
}
check('the teacher can answer it', (await text(teacher)).includes('In touch'));

// ------------------------------------------ the parent sees who answered
const parent = await signIn('parent');
const listed = await visit(parent, '/requests', 6_000);
check('the parent sees their own request', listed.includes('tutor for Form 2'));

/*
  Pick the request rather than trusting whichever one the screen opened on.
  This parent has more than one posting — drive-assignment.mjs posts a one-off
  as them — and the screen quite correctly selects the most recent, which is
  not the one this script is about.
*/
await parent.getByText('Maths and physics tutor for Form 2').first().click();
await parent.waitForTimeout(4_000);
const requests = await text(parent);
check('the parent sees who answered', requests.includes('Grace Achieng'));
// A school receives applications; a parent receives answers.
check(
  'the parent screen says answered, not applied',
  requests.includes('Answered') && !requests.includes('· applied'),
);
check('the parent is reminded not to share the address yet', requests.includes('share where you are'));

await parent.getByText(/^Message Grace$/).first().click();
await parent.waitForTimeout(5_000);
check('the parent can open the conversation', new URL(parent.url()).pathname.startsWith('/messages/'));
await parent.getByPlaceholder('Write a message…').fill('Thank you for answering. Are Tuesdays and Thursdays possible?');
await parent.getByLabel('Send').click();
await parent.waitForTimeout(4_500);
check('the parent can send', (await text(parent)).includes('Tuesdays and Thursdays'));

// --------------------- and the teacher hears from a person, not "a school"
const notifications = await visit(teacher, '/notifications', 5_000);
check(
  'the teacher is notified by name, not "A school"',
  notifications.includes('Mary Wambui') && !notifications.includes('A school'),
);

await finish();
