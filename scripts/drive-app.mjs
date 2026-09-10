/**
 * The core paths, driven in a real browser against the live project.
 *
 * Every bug in this app that mattered — dead filter chips, a download button
 * with no handler, `insert … returning` blocked by its own SELECT policy, a
 * bookmark that also opened the job, a feed with no way into it — passed
 * typecheck and passed the unit tests. This is the check that found them.
 *
 * See scripts/drive-harness.mjs for how to run it.
 */
import { startHarness } from './drive-harness.mjs';

const { check, signIn, visit, finish } = await startHarness({ port: 4300 });

// ---------------------------------------------------------------- the teacher
const teacher = await signIn('teacher');
check('teacher lands on Home, not onboarding', new URL(teacher.url()).pathname === '/');

const jobs = await visit(teacher, '/jobs');
check('jobs list renders roles', /open roles/.test(jobs));

const resources = await visit(teacher, '/resources');
check('resource library lists real files', resources.includes('template'));

// Back on Jobs: the bookmark lives on the job cards, not in the library.
await visit(teacher, '/jobs');
const bookmark = teacher.getByRole('button', { name: /^(Save|Remove) / }).first();
const before = await bookmark.getAttribute('aria-label');
await bookmark.click();
await teacher.waitForTimeout(2_500);
// The bookmark used to sit inside the card's Link, so saving also opened the
// job. Staying on /jobs is the whole assertion.
check('bookmarking does not open the job', new URL(teacher.url()).pathname === '/jobs');
const after = await teacher.getByRole('button', { name: /^(Save|Remove) / }).first().getAttribute('aria-label');
check('bookmark toggles', before !== after);

check('teacher is refused the moderation queue', (await visit(teacher, '/admin')).includes('Not your desk'));

// ------------------------------------------------------------- the moderator
const admin = await signIn('admin');
// Longer: the gate asks the RPC first, then the queues load behind it.
const queue = await visit(admin, '/admin', 8_000);
// Any of the three queues, or the honest empty state. Asserting on one of
// them alone fails the moment that queue happens to be clear, which is what
// the first version of this check did.
check(
  'moderator sees the queues',
  /Reviews to read|Schools to verify|TSC numbers to check|Nothing waiting/i.test(queue),
);
check('moderator can reach the news composer', queue.includes('Publish an update'));

// ------------------------------------------------------------ both directions
const recruiter = await signIn('recruiter');
const dashboard = await visit(recruiter, '/recruiter');
check('recruiter sees their school', dashboard.includes('Fixture Valley School'));

await finish();
