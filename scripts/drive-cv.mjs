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
 * Open a section, if it is not open already.
 *
 * The form is eleven collapsed sections, so every field below is behind one.
 * Matching on `expanded: false` rather than clicking blindly means calling
 * this twice does not close what it opened.
 */
const expand = async (page, title) => {
  const header = page.getByRole('button', { name: new RegExp(`^${title}`), expanded: false });
  if (await header.count() > 0) {
    await header.first().click();
    await page.waitForTimeout(600);
  }
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
  'Skills and languages', 'Volunteer work', 'Certificates', 'Referees',
].every((s) => cv.includes(s)));
check('and offers the preview as a button rather than a page of iframe',
  cv.includes('Preview and download'));

/*
  Collapsed is the point: eleven sections laid end to end is a page nobody
  scrolls to the bottom of. The closed rows still have to say where you are,
  which is what the summary on each header is for.
*/
check('the sections start closed', !cv.includes('Personal statement'));
check('a closed section still says whether it is filled in', cv.includes('Not filled in'));
await expand(teacher, 'Personal details');
check('opening one shows its fields', (await text(teacher)).includes('Personal statement'));
await expand(teacher, 'Personal details');
await teacher.waitForTimeout(400);
check('and it stays open rather than toggling twice', (await text(teacher)).includes('Personal statement'));


/*
  Set the sharing explicitly rather than trusting the default: the last thing
  this script does is switch the CV to "Only me", so a second run starts from
  a CV the recruiter cannot read. Setting it here also exercises the change in
  the other direction, which the end of the script does not.
*/
await expand(teacher, 'Who can read it');
await press(teacher, 'People I apply to');
check('the teacher can share it with the people they apply to',
  (await text(teacher)).includes('once you have applied to their listing'));
await expand(teacher, 'Who can read it');

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
await expand(teacher, 'Skills and languages');
for (const list of ['Skills', 'Languages', 'Hobbies', 'Positions of responsibility']) {
  await clearList(teacher, list);
}
for (const [placeholder, value, list] of [
  ['Computer packages', 'Laboratory management', 'Skills'],
  ['Kiswahili', 'Kiswahili', 'Languages'],
  ['Reading novels', 'Chess', 'Hobbies'],
  ['Class teacher, Form 4G', 'Head of Science', 'Positions of responsibility'],
]) {
  // The + is disabled until there is something to add, and it says so.
  const plus = teacher.getByLabel(`Add to ${list}`);
  // Languages has its own editor and its own wording, so this asks for the
  // one that belongs to the list being tested rather than for any of them.
  const wanted = list === 'Languages' ? 'Write a language first' : 'Write something first';
  check(`${list}: the + says why it is not clickable yet`,
    await plus.isDisabled() && (await text(teacher)).includes(wanted));
  await fill(teacher, placeholder, value);
  await plus.click();
  await teacher.waitForTimeout(1500);
}
// No Save button: an add is already a deliberate act, and one that only
// survived a second press was indistinguishable from a + that did nothing.
await visit(teacher, '/profile/cv', 6000);
await expand(teacher, 'Skills and languages');
const afterLists = await text(teacher);
check('every list survived a reload without a Save button',
  ['Laboratory management', 'Kiswahili', 'Chess', 'Head of Science'].every((v) => afterLists.includes(v)));

await expand(teacher, 'Certificates');
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
/*
  The preview is its own screen now. It used to be a page-tall iframe at the
  bottom of the form, which is the one place nobody looks while filling a form
  in, and it re-rendered an A4 page on every save.
*/
const beforePreview = await text(teacher);
check('the form no longer carries the document itself',
  !beforePreview.includes('Personal statement') || !beforePreview.includes('Preview & download'));
await press(teacher, 'Preview and download');
await teacher.waitForTimeout(6000);
check('the Preview button opens the preview',
  new URL(teacher.url()).pathname.endsWith('/cv-preview'));

const frame = teacher.frameLocator('iframe[title="CV preview"]');
await teacher.waitForTimeout(2500);
const document = (await frame.locator('body').innerText()).replace(/\s+/g, ' ');
check('the preview is the two-column document', document.includes('Personal details'));
check('the preview carries what was typed', [
  'Grace Achieng', 'Nairobi', '23 December 1996', 'Female', 'Kenyan',
  'Laboratory management', 'Kiswahili', 'Chess', 'Head of Science',
  'Certificate in Computer Packages',
].every((v) => document.includes(v)));
check('the address prints with the post code and city',
  document.includes('P.O Box 991-00100') && document.includes('00100 Nairobi'));
await teacher.screenshot({ path: 'shots-audit/cv-preview.png', fullPage: true });

// ------------------------------------------------------- and it can be restyled
await teacher.getByText(/^Change the look/).first().click();
await teacher.waitForTimeout(1200);
// Upper-cased by CSS, and `innerText` returns what is rendered rather than
// what is in the markup — so this matches either way.
check('the controls open', /page margins/i.test(await text(teacher)));
await teacher.getByText('Bold', { exact: true }).first().click();
await teacher.waitForTimeout(3500);
const bold = await teacher.frameLocator('iframe[title="CV preview"]').locator('body')
  .evaluate((b) => getComputedStyle(b).backgroundImage);
check('picking a template repaints the document', bold.includes('gradient'));
// The look is stored as it is chosen, so leaving and coming back keeps it.
await visit(teacher, '/profile/cv-preview', 7000);
check('and the choice survives leaving the screen',
  (await text(teacher)).includes('Change the look — Bold'));
await teacher.getByText(/^Change the look/).first().click();
await teacher.waitForTimeout(1000);
await teacher.getByText('Portrait', { exact: true }).first().click();
await teacher.waitForTimeout(3000);

// ------------------------------------------------- sections move and get renamed
await visit(teacher, '/profile/cv', 6000);
await expand(teacher, 'Sections');
const startOrder = await teacher.getByLabel(/^Rename /).allTextContents();
check('the sections are listed in order', startOrder[0] === 'Personal details');

/*
  Skills and Languages, not Education and Employment.

  A section with nothing in it is left off the document entirely, so moving or
  renaming an empty one proves nothing about the page — and this fixture has no
  education or employment rows. These two are both filled in and both live in
  the sidebar, which is also where a reorder has to stay.
*/
await teacher.getByLabel('Move Languages up').click();
await teacher.waitForTimeout(3000);
const moved = await teacher.getByLabel(/^Rename /).allTextContents();
check('an arrow moves a section', moved.indexOf('Languages') < moved.indexOf('Skills'));

/*
  And the handle itself, not only the arrows.

  They call the same function, so this is really asking whether the pan gesture
  is wired up at all — which is exactly the thing that silently stops working
  when a gesture root goes missing, while every arrow keeps on working.
*/
const handle = teacher.getByLabel('Move Profile', { exact: true }).first();
// Scroll it into view first: the drag works in viewport coordinates, and a
// handle sitting below the fold gets a box the mouse never reaches.
await handle.scrollIntoViewIfNeeded();
await teacher.waitForTimeout(400);
const wasAt = (await teacher.getByLabel(/^Rename /).allTextContents()).indexOf('Profile');
const box = await handle.boundingBox();
await teacher.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await teacher.mouse.down();
await teacher.waitForTimeout(250);
for (let i = 1; i <= 10; i += 1) {
  await teacher.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + i * 10.4);
  await teacher.waitForTimeout(20);
}
await teacher.mouse.up();
await teacher.waitForTimeout(3500);
const dragged = await teacher.getByLabel(/^Rename /).allTextContents();
const nowAt = dragged.indexOf('Profile');
check(`dragging the handle moves a section too (${wasAt} -> ${nowAt})`, nowAt === wasAt + 2);
// Back where it was, by the arrows this time.
for (let i = 0; i < nowAt - wasAt; i += 1) {
  await teacher.getByLabel('Move Profile up').click();
  await teacher.waitForTimeout(2200);
}

const rename = async (from, to) => {
  await teacher.getByLabel(`Rename ${from}`).click();
  await teacher.waitForTimeout(700);
  // Select-all first. The field selects its own text on focus, but a script
  // that relied on that would pass even if the app stopped doing it.
  await teacher.keyboard.press('Control+a');
  await teacher.keyboard.type(to);
  await teacher.keyboard.press('Enter');
  await teacher.waitForTimeout(3000);
};

await rename('Profile', 'About me');
check('tapping a name renames the section',
  (await teacher.getByLabel(/^Rename /).allTextContents()).includes('About me'));

await visit(teacher, '/profile/cv-preview', 8000);
const page = teacher.frameLocator('iframe[title="CV preview"]').locator('body');
const printed = (await page.innerText()).replace(/\s+/g, ' ');
check('the document uses the new word', printed.includes('About me'));
check('and not the old one', !printed.includes('Profile'));
check('and prints the sections in the new order',
  printed.indexOf('Languages') < printed.indexOf('Skills'));

// Put it back, so the script can be run twice.
await visit(teacher, '/profile/cv', 6000);
await expand(teacher, 'Sections');
await rename('About me', 'Profile');
await teacher.getByLabel('Move Languages down').click();
await teacher.waitForTimeout(2500);
const restored = await teacher.getByLabel(/^Rename /).allTextContents();
check('and it can be put back',
  restored.includes('Profile') && restored.indexOf('Skills') < restored.indexOf('Languages'));

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
await expand(teacher, 'Who can read it');
await press(teacher, 'Only me');
await teacher.waitForTimeout(3000);
check('the teacher can make it private', (await text(teacher)).includes('Nobody can open your CV here'));

await visit(recruiter, `/applicant/${TEACHER}/cv`, 7000);
const refused = await text(recruiter);
check('and the recruiter loses it immediately', refused.includes('No CV to show'));
check('without being told why', !refused.includes('private') && !refused.includes('Only me'));

await finish();
