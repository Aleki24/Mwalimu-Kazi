/**
 * Somebody is asked, writes, and hears back.
 *
 * There were no reviews in production at all. Not one — on an app whose whole
 * argument is that you should read what teachers said about a school before
 * you apply to it. The form was never broken; nothing had ever asked anybody
 * to fill it in, and the only route to it was to think of a school, search for
 * it, open its page and notice a link.
 *
 * So this drives the asking, and then the half after it that was also missing:
 * a moderator publishes the review a day later and the author is told.
 *
 * It runs in one of two states and says which. On a fresh fixture set the
 * teacher has not written about Fixture Valley School and the whole loop runs.
 * On a re-run they have, so the prompt is correctly gone and the script checks
 * the far end instead — the review on the school page, the notification in the
 * author's list. Both halves are the same loop seen from different points.
 *
 * See scripts/drive-harness.mjs for how to run it.
 */
import { startHarness } from './drive-harness.mjs';

const { check, signIn, text, type, visit, finish } = await startHarness({ port: 4900 });

const SCHOOL = 'Fixture Valley School';
const ASK = `What was ${SCHOOL} like?`;
const BODY = 'They were clear about the salary band before the interview and the '
  + 'head of department sat in on it, which told me more than the advert did. '
  + 'Marking load is heavy in Term 2.';

const press = async (page, name, wait = 2_500) => {
  await page.getByText(name, { exact: true }).first().click();
  await page.waitForTimeout(wait);
};

const teacher = await signIn('teacher');
const home = await visit(teacher, '/', 7_000);
const asked = home.includes(ASK);

if (asked) {
  // ------------------------------------------------- the question gets asked
  check('home asks the teacher about a school that answered them', true);
  check('and says why them, rather than asking the world',
    /You met them|they answered|on the staff/.test(home));

  const list = await visit(teacher, '/applications', 6_000);
  check('the applications screen asks too, where the answer came from',
    list.includes('Tell other teachers') && list.includes(ASK));

  // ------------------------------------------------------- and gets answered
  await press(teacher, ASK, 5_000);
  const form = await text(teacher);
  check('the form opens on the school it asked about', form.includes(SCHOOL));
  check('and fills in the role they applied for',
    form.includes('Mathematics Teacher') || form.includes('Form 3'));

  // One rating is enough for the schema; a teacher is not made to score ten.
  await teacher.getByLabel(/Pay reliability: 4 of 5/).first().click();
  await teacher.waitForTimeout(400);
  await type(teacher, /What was it actually like to teach there/i, BODY);
  await teacher.waitForTimeout(600);

  await press(teacher, 'Send for review', 6_000);
  const sent = await text(teacher);
  check('sending says a moderator reads it first, not that it is live',
    /moderator/i.test(sent));

  // -------------------------------------------------- and is not asked twice
  const again = await visit(teacher, '/', 7_000);
  check('and the app stops asking about that school', !again.includes(ASK));
} else {
  check('a school already written about is not asked about again', true);
}

// ------------------------------------------------ a moderator reads it
const moderator = await signIn('admin');
const queue = await visit(moderator, '/admin', 8_000);

if (queue.includes(SCHOOL) && queue.includes('Publish')) {
  check('the review reaches the moderator with the school named', true);
  check('and the moderator is told what to reject',
    queue.includes('names an individual'));
  await press(moderator, 'Publish', 5_000);
  check('publishing clears it from the queue',
    !(await text(moderator)).includes(BODY.slice(0, 40)));
}

// --------------------------------------------------- and the author is told
const inbox = await visit(teacher, '/notifications', 7_000);
check('the author is told their review is live', inbox.includes('Your review is live'));
check('and told where it went', inbox.includes(SCHOOL));

// ----------------------------------------------- and it is on the school page
const page = await visit(teacher, '/schools', 6_000);
check('the schools list finds the school', page.includes(SCHOOL));
await press(teacher, SCHOOL, 6_000);
const profile = await text(teacher);
check('the school page is no longer empty', !profile.includes('No reviews yet'));
check('and carries what the teacher actually wrote',
  profile.includes('salary band') || profile.includes('Read all'));

await finish();
