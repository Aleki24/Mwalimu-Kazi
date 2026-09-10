/**
 * Building a CV, deciding who may read it, and a recruiter reading it.
 *
 * The CV screen is the longest form in the app and the only one whose output
 * is a document somebody sends to an employer, so most of what is asserted
 * below is that what was typed comes back out on the page. The last third is
 * the part that is not about typing at all: a teacher sets the CV to "Only
 * me", and the recruiter who had been reading it a moment ago cannot any more.
 *
 * See scripts/drive-harness.mjs for how to run it.
 */
import { startHarness } from './drive-harness.mjs';

const TEACHER = '00000000-0000-4000-8000-0000000000f1';
const { check, signIn, text, type, visit, finish } = await startHarness({ port: 4600 });

const fill = (page, label, value) => type(page, label, value);
const press = async (page, name) => {
  await page.getByText(name, { exact: true }).first().click();
  await page.waitForTimeout(2500);
};

/**
 * Empty a list before filling it, so the script can be run twice.
 *
 * It also exercises the remove button, which is the half of the list editor a
 * happy-path script would never touch. The duplicate guard means a second run
 * without this leaves Add correctly disabled and the run reads as a bug in the
 * app rather than as a rerun.
 */
const clearList = async (page, label) => {
  for (let i = 0; i < 25; i += 1) {
    const remove = page.getByLabel(new RegExp(`^Remove .* from ${label}$`)).first();
    if (await remove.count() === 0) break;
    await remove.click();
    await page.waitForTimeout(200);
  }
};

// ------------------------------------------------------ the teacher builds it
const teacher = await signIn('teacher');
const cv = await visit(teacher, '/profile/cv', 6000);
check('the CV screen offers every section', [
  'Who can read it', 'Photograph', 'Personal details', 'Experience', 'Education',
  'Skills and languages', 'Volunteer work', 'Certificates', 'Referees', 'Preview & download',
].every((s) => cv.includes(s)));
check('Portrait is the template it starts on', cv.includes('Portrait'));

await fill(teacher, 'you@example.com', 'grace@example.com');
await fill(teacher, '+254 712 345678', '0712345678');
await fill(teacher, 'P.O. Box 132-50311', 'P.O Box 991-00100');
await fill(teacher, '50311', '00100');
await fill(teacher, 'Nairobi', 'Nairobi');
await fill(teacher, '23/12/1996', '23/12/1996');
await fill(teacher, 'Female', 'Female');
await fill(teacher, 'Kenyan', 'Kenyan');
await fill(teacher, 'Two or three sentences: what you teach, how long, and what you are looking for.',
  'A mathematics and physics teacher of six years, looking for a school that takes its laboratory seriously.');
await press(teacher, 'Save details');
check('the personal details save', !(await text(teacher)).includes('Could not save'));

// The lists: one from each editor, to prove the shared component is wired to
// four different pieces of state and not to one.
for (const list of ['Skills', 'Languages', 'Hobbies', 'Positions of responsibility']) {
  await clearList(teacher, list);
}
for (const [placeholder, value, list] of [
  ['Computer packages', 'Laboratory management', 'Skills'],
  ['Kiswahili', 'Kiswahili', 'Languages'],
  ['Reading novels', 'Chess', 'Hobbies'],
  ['Class teacher, Form 4G', 'Head of Science', 'Positions of responsibility'],
]) {
  await fill(teacher, placeholder, value);
  await teacher.getByLabel(`Add to ${list}`).click();
  await teacher.waitForTimeout(500);
}
await press(teacher, 'Save lists');
const afterLists = await text(teacher);
check('every list editor saved its own list', ['Laboratory management', 'Kiswahili', 'Chess', 'Head of Science']
  .every((v) => afterLists.includes(v)));

// Certificates have no duplicate guard — two identical rows are a legitimate
// thing to have — so a rerun has to clear its own before adding.
for (let i = 0; i < 5; i += 1) {
  const old = teacher.getByLabel('Remove Certificate in Computer Packages').first();
  if (await old.count() === 0) break;
  await old.click();
  await teacher.waitForTimeout(2500);
}
await fill(teacher, 'Certificate in computer packages', 'Certificate in Computer Packages');
await fill(teacher, 'Probation Community Resource & Training Centre, Webuye', 'Kenya Institute of Management');
await fill(teacher, '2016', '2016');
await press(teacher, 'Add certificate');
check('the certificate saves with its year', (await text(teacher)).includes('Kenya Institute of Management'));

// ------------------------------------------------------- and it renders
const frame = teacher.frameLocator('iframe[title="CV preview"]');
await teacher.waitForTimeout(2000);
const document = (await frame.locator('body').innerText()).replace(/\s+/g, ' ');
check('the preview is the two-column document', document.includes('Personal details'));
check('the preview carries what was typed', [
  'Grace Achieng', 'Nairobi', '23 December 1996', 'Female', 'Kenyan',
  'Laboratory management', 'Kiswahili', 'Chess', 'Head of Science',
  'Certificate in Computer Packages',
].every((v) => document.includes(v)));
check('the address prints with the post code and city',
  document.includes('P.O Box 991-00100') && document.includes('00100 Nairobi'));
await teacher.screenshot({ path: 'shots-audit/cv-editor.png', fullPage: true });

// ------------------------------------- the recruiter reads it, then cannot
const recruiter = await signIn('recruiter');
await visit(recruiter, '/recruiter', 6000);
await recruiter.getByText('Fixture Valley School', { exact: false }).first().click();
await recruiter.waitForTimeout(5000);
check('the applicant card offers the CV', (await text(recruiter)).includes('View CV'));
await recruiter.getByText('View CV', { exact: true }).first().click();
await recruiter.waitForTimeout(6000);
const shared = await text(recruiter);
check('the recruiter can read a CV set to "People I apply to"', shared.includes('Shared with you by Grace Achieng'));
const sharedDoc = (await recruiter.frameLocator('iframe[title="CV preview"]').locator('body').innerText())
  .replace(/\s+/g, ' ');
check('and it is the same document', sharedDoc.includes('Laboratory management'));
await recruiter.screenshot({ path: 'shots-audit/cv-recruiter.png', fullPage: true });

await visit(teacher, '/profile/cv', 6000);
await press(teacher, 'Only me');
await teacher.waitForTimeout(3000);
check('the teacher can make it private', (await text(teacher)).includes('Nobody can open your CV here'));

await visit(recruiter, `/applicant/${TEACHER}/cv`, 7000);
const refused = await text(recruiter);
check('and the recruiter loses it immediately', refused.includes('No CV to show'));
check('without being told why', !refused.includes('private') && !refused.includes('Only me'));

await finish();
