/**
 * A teacher lists themselves, a parent finds them, and the two of them talk.
 *
 * This is the half of the tuition market that did not exist: before it, a
 * parent could post a request and wait, and a teacher who tutors could not be
 * looked up at all. Most of what is asserted below is about that direction —
 * that being listed is a choice, that the directory does not leak a profile,
 * and that getting in touch produces a conversation attached to a real
 * request rather than a bare message.
 *
 * See scripts/drive-harness.mjs for how to run it.
 */
import { startHarness } from './drive-harness.mjs';

const { check, signIn, text, type, visit, finish } = await startHarness({ port: 4700 });

/*
  This script gets in touch about its own request, not the one drive-tuition
  uses. Inviting a tutor turns an application's source to `invited`, and doing
  that to the tuition fixture made drive-tuition's "Answered, not applied"
  check fail for a reason that had nothing to do with tuition.
*/
const REQUEST = 'Tutor found through the directory';

const press = async (page, name) => {
  await page.getByText(name, { exact: true }).first().click();
  await page.waitForTimeout(2500);
};

// ------------------------------------------------ nobody is listed to start
const parent = await signIn('parent');
const empty = await visit(parent, '/tutors', 6_000);
check('the directory starts empty rather than listing everybody',
  empty.includes('No tutors here yet'));
check('and offers the other route instead', empty.includes('Post a request'));

// ------------------------------------------ a request of this script's own
const mine = await visit(parent, '/requests', 6_000);
if (!mine.includes(REQUEST)) {
  await visit(parent, '/post/new', 4_000);
  await parent.getByText('Private tuition', { exact: true }).first().click();
  await parent.waitForTimeout(1_200);
  await type(parent, 'Maths tutor for Grade 6, twice a week', REQUEST);
  await type(parent, 'mathematics, physics', 'mathematics');
  // The post form's area field is labelled differently from the tutoring one.
  await parent.getByPlaceholder(/Kilimani|Ward|estate/i).first().fill('Westlands');
  await parent.waitForTimeout(600);
  await parent.getByText(/^Post (this )?(role|request)$/).first().click();
  await parent.waitForTimeout(6_000);
}
check('the parent has a request to get in touch about',
  (await visit(parent, '/requests', 6_000)).includes(REQUEST));

// --------------------------------------------- the teacher lists themselves
const teacher = await signIn('teacher');
const form = await visit(teacher, '/profile/tutoring', 6_000);
check('a teacher can offer tuition', form.includes('Offer tuition'));
check('and is told nobody can see it yet', form.includes('Nobody can see this yet'));

await type(teacher, 'Maths and physics, Form 1 to 4', 'Maths and physics, Form 1 to 4');
await type(teacher, 'Kilimani', 'Kilimani');
await type(teacher, '800', '900');
await type(teacher, '1200', '1400');

/*
  A subject chip toggles, so a second run would switch Mathematics back off and
  leave the button correctly disabled — which reads as a broken form rather
  than as a rerun. Click, then look at the button and click again if that was
  the wrong direction.
*/
const listButton = () => teacher.getByRole('button', { name: /^List me under Find a tutor$/ }).first();
const maths = () => teacher.getByRole('button', { name: 'Mathematics', exact: true }).first();
await maths().click();
await teacher.waitForTimeout(600);
if (await listButton().isDisabled()) {
  await maths().click();
  await teacher.waitForTimeout(600);
}
check('the form refuses to list a tutor with no subject', !(await listButton().isDisabled()));
await listButton().click();
await teacher.waitForTimeout(2500);
const listed = await text(teacher);
check('switching it on says so plainly', listed.includes('You are listed'));

// ------------------------------------------------- and can be found by name
const found = await visit(parent, '/tutors', 6_000);
check('the parent can now find them', found.includes('Grace Achieng'));
check('and sees what they charge', /900–1,400\/hr|KSh 900/.test(found));
check('and the safety notice', found.includes('never send money'));
await parent.screenshot({ path: 'shots-audit/tutors.png', fullPage: true });

// A subject they do not teach must not match.
await parent.getByRole('button', { name: 'Chemistry', exact: true }).first().click();
await parent.waitForTimeout(3_000);
check('a subject filter that does not match hides them',
  !(await text(parent)).includes('Grace Achieng'));
await parent.getByRole('button', { name: 'Chemistry', exact: true }).first().click();
await parent.waitForTimeout(3_000);

// --------------------------------------------------------- and got in touch
await parent.getByText('Grace Achieng', { exact: false }).first().click();
await parent.waitForTimeout(5_000);
const page = await text(parent);
check('the tutor page names what they teach', page.includes('Mathematics'));
check('and where, without an address', page.includes('Kilimani') && !page.includes('P.O'));
check('and warns this is a listing, not a vetting', page.includes('never pay a deposit'));

await parent.getByText(/^Contact Grace$/).first().click();
await parent.waitForTimeout(2_000);
check('contacting asks which request it is about',
  (await text(parent)).includes('Which request is this about'));
await parent.getByText(REQUEST, { exact: false }).first().click();
await parent.waitForTimeout(6_000);
check('and opens the conversation',
  new URL(parent.url()).pathname.startsWith('/messages/'));

await parent.getByPlaceholder('Write a message…').fill('I found you here — are Tuesdays possible?');
await parent.getByLabel('Send').click();
await parent.waitForTimeout(4_500);
check('the parent can write to them', (await text(parent)).includes('Tuesdays possible'));

// ------------------------------- and it is recorded as what it was
await visit(parent, '/requests', 6_000);
await parent.getByText(REQUEST, { exact: false }).first().click();
await parent.waitForTimeout(4_000);
const answered = await text(parent);
check('the request shows them as invited, not as an applicant',
  answered.includes('Invited') && answered.includes('you got in touch'));
check('and shows no match score nobody calculated', !answered.includes('Scored 0%'));

// ------------------------------------------------ switching it off hides them
await visit(teacher, '/profile/tutoring', 6_000);
await press(teacher, 'Take me off the list');
check('a teacher can take themselves off', (await text(teacher)).includes('not listed'));

const after = await visit(parent, '/tutors', 6_000);
check('and is gone from the directory immediately', !after.includes('Grace Achieng'));

await finish();
