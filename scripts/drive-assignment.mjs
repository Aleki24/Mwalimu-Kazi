/**
 * Posting a one-off assignment, and finding it again.
 *
 * `assignment` shipped as an enum value the Jobs screen could filter by and
 * the post form could not produce: a tab that was permanently empty. The
 * picker now comes straight off the enum, and this is the check that it still
 * does — it posts one as a parent and finds it under the tab as a teacher.
 *
 * See scripts/drive-harness.mjs for how to run it. It leaves a listing behind;
 * the fixture teardown removes it with the account that posted it.
 */
import { startHarness } from './drive-harness.mjs';

const { check, signIn, text, visit, finish } = await startHarness({ port: 4500 });

const parent = await signIn('parent');
const form = await visit(parent, '/post/new', 4_000);
check('the form offers a one-off assignment', form.includes('One-off assignment'));

await parent.getByText('One-off assignment', { exact: true }).first().click();
await parent.waitForTimeout(1_200);
const chosen = await text(parent);
// A one-off happens once; "how many days a week" has no answer.
check('the frequency question disappears for a one-off', !chosen.includes('Days a week'));
check('the rate defaults to per session', /Per session|Session/.test(chosen));

await parent.getByPlaceholder(/tutor|Maths/i).first().fill('Mark 40 KCSE chemistry papers');
await parent.getByPlaceholder('mathematics, physics').fill('chemistry');
await parent.getByPlaceholder(/Kilimani|Ward|estate/i).first().fill('Westlands');
await parent.waitForTimeout(600);
await parent.getByText(/^Post (this )?(role|request)$/).first().click();
await parent.waitForTimeout(6_000);
check('the assignment posts', (await text(parent)).includes('live'));

const teacher = await signIn('teacher');
await visit(teacher, '/jobs', 5_000);
await teacher.getByRole('button', { name: 'Assignments', exact: true }).first().click();
await teacher.waitForTimeout(3_000);
const listed = await text(teacher);
check('the Assignments tab finds it', listed.includes('chemistry papers'));
check('the Assignments tab drops school vacancies', !listed.includes('Chemistry Teacher'));

await finish();
