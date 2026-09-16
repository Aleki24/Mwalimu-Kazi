/**
 * Building a CV, and what the app says about it while you do.
 *
 * The editor was rewritten twice in two days — first into a readiness card
 * over collapsed folds, then again so that each card *is* the section of the
 * document it edits, carrying the heading that prints and the position that
 * prints. This script was written against neither, described a screen that no
 * longer existed, and timed out on its second check. A drive that describes
 * the previous version of a screen is worse than no drive: it goes red for
 * reasons that have nothing to do with the app, and teaches you to ignore it.
 *
 * So it is rewritten to the editor as it stands, and asserts the things those
 * rewrites were for:
 *
 *   * the card at the top counts what is owed rather than what exists;
 *   * a closed card still says what is in it, and one opens at a time;
 *   * tapping a saved entry loads it back into the form that wrote it, so a
 *     correction is a correction and not a second copy beside the first;
 *   * the heading and the order belong to the teacher, from the card itself;
 *   * privacy still decides who may open the CV, and a recruiter who could
 *     read it a moment ago cannot once it is private.
 *
 * See scripts/drive-harness.mjs for how to run it.
 */
import { startHarness } from './drive-harness.mjs';

const { check, signIn, text, type, visit, finish, idOf } =
  await startHarness({ port: 4600 });

// Resolved, not assumed: see idOf in drive-harness.mjs for why.
const TEACHER = await idOf('teacher');

const ROLE = 'Head of Mathematics';
const SCHOOL = 'Fixture Valley School';
const CORRECTED = 'Head of Mathematics and Physics';

/**
 * Bring a control into view, then press it.
 *
 * The readiness card made this page long enough that most of it sits outside
 * the scroll viewport, and Playwright's own scrolling moves the window rather
 * than the ScrollView's inner div — so the element it is about to click is
 * still off-screen and whatever is at those coordinates takes the click. It
 * reads as "a card intercepts pointer events", which sounds like a layout bug
 * and is not one. `scrollIntoView` on the element scrolls the container that
 * actually holds it.
 *
 * By role first: the label is on the Pressable, and the text node inside it is
 * a child that does not receive the press.
 */
const reach = async (page, locator) => {
  await locator.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(250);
  return locator;
};

const press = async (page, name, wait = 2_000) => {
  const byRole = page.getByRole('button', { name, exact: true });
  const target = await byRole.count() > 0
    ? byRole.first()
    : page.getByText(name, { exact: true }).first();
  await (await reach(page, target)).click();
  await page.waitForTimeout(wait);
};

const tap = async (page, label, wait = 1_500) => {
  await (await reach(page, page.getByLabel(label, { exact: true }).first())).click();
  await page.waitForTimeout(wait);
};

/**
 * Open one section by name.
 *
 * The chevron carries `Open X` / `Close X`, which is the only handle that says
 * which state it is in — once a card is open its heading becomes a rename
 * button, so clicking the heading to "open" a section would start editing its
 * title instead.
 */
const open = async (page, title) => {
  const chevron = page.getByLabel(`Open ${title}`, { exact: true });
  if (await chevron.count() > 0) {
    await (await reach(page, chevron.first())).click();
    await page.waitForTimeout(900);
  }
};

/** Remove an entry: one tap asks, the second confirms. Both wear the same label. */
const removeEntry = async (page, title) => {
  const button = page.getByLabel(`Remove ${title}`, { exact: true });
  if (await button.count() === 0) return false;
  await (await reach(page, button.first())).click();
  await page.waitForTimeout(400);
  await (await reach(page, page.getByLabel(`Remove ${title}`, { exact: true }).last())).click();
  await page.waitForTimeout(1_800);
  return true;
};

const percentIn = (page) => Number(/(\d+)% complete/.exec(page)?.[1] ?? '-1');

/**
 * The CV itself, which is an HTML document in an iframe rather than a screen.
 * Reading the page around it tells you nothing about what the document says.
 */
const rendered = async (page) => (
  await page.frameLocator('iframe[title="CV preview"]').locator('body').innerText()
).replace(/\s+/g, ' ');

/** A card's summary only shows while the card is closed. */
const closedSummary = async (page, title) => {
  const chevron = page.getByLabel(`Close ${title}`, { exact: true });
  if (await chevron.count() > 0) {
    await (await reach(page, chevron.first())).click();
    await page.waitForTimeout(900);
  }
  return text(page);
};

// ------------------------------------------------------------- what it says
const teacher = await signIn('teacher');
let cv = await visit(teacher, '/profile/cv', 7_000);

check('the editor opens on what the CV still needs',
  /Your CV (so far|is ready to send|is complete)/.test(cv));
check('and counts it in essentials rather than in fields',
  /ready to send|Every section has something in it/.test(cv));
check('it says how complete, as a number', percentIn(cv) >= 0);
check('and offers the preview as a button rather than a page of iframe',
  cv.includes('Preview and download'));

check('every section of the CV is on the page as a card of its own', [
  'Personal details', 'Profile', 'Education', 'Employment', 'Skills',
  'Languages', 'Hobbies', 'Volunteer work', 'Responsibilities',
  'Certificates', 'Referees', 'Who can read it',
].every((s) => cv.includes(s)));

/*
  Closed cards still say what is in them. That is what makes a page of twelve
  sections readable without opening any of them, and it is the first thing a
  rewrite tends to lose.
*/
check('a closed card says what is in it',
  /Empty|Written|Not added|Nothing yet|\d+ (role|roles|qualification|qualifications|skill|skills|referee|referees|language|languages|certificate|certificates)/
    .test(cv));

// ------------------------------------------------------------ one at a time
await open(teacher, 'Profile');
check('opening a section opens it',
  await teacher.getByLabel('Close Profile', { exact: true }).count() > 0);

await open(teacher, 'Employment');
check('and opening another closes the first',
  await teacher.getByLabel('Close Profile', { exact: true }).count() === 0
  && await teacher.getByLabel('Close Employment', { exact: true }).count() > 0);

// -------------------------------------------------------------- writing in it
// Start from nothing, so a second run is a first run.
await removeEntry(teacher, ROLE);
await removeEntry(teacher, CORRECTED);
await open(teacher, 'Employment');

await type(teacher, 'Mathematics Teacher', ROLE);
await type(teacher, 'Greenfield Academy', SCHOOL);
await type(teacher, '2019', '2019');
await type(teacher, '2022', '2023');
await teacher.waitForTimeout(400);
await press(teacher, 'Add role', 3_500);

const added = await text(teacher);
check('a role can be added', added.includes(ROLE));
check('and the card counts it, once closed',
  /1 role\b/.test(await closedSummary(teacher, 'Employment')));
await open(teacher, 'Employment');

// --------------------------------------------- a correction is a correction
/*
  The editor used to find a saved entry again by matching its title and
  institution, which removed the wrong one for anybody who had taught the same
  subject at two schools. Tapping it now loads it back into the form that wrote
  it and saves over that row.
*/
await tap(teacher, `Edit ${ROLE}`);
check('tapping a saved entry says it is being edited',
  (await text(teacher)).includes('Editing'));

await type(teacher, 'Mathematics Teacher', CORRECTED);
await teacher.waitForTimeout(400);
await press(teacher, 'Save changes', 3_500);

const corrected = await text(teacher);
check('correcting an entry rewrites it', corrected.includes(CORRECTED));
check('rather than leaving a second copy beside it',
  /1 role\b/.test(await closedSummary(teacher, 'Employment')));

// --------------------------------------------------- the heading is theirs
await open(teacher, 'Employment');
await tap(teacher, 'Section options');
const options = await text(teacher);
check('a section can be moved from its own header',
  options.includes('Move up') && options.includes('Move down'));
check('and the app says what that does to the printed page',
  options.includes('heading and the position on the printed CV'));

// ------------------------------------------------------ and the count moves
const before = percentIn(cv);
cv = await visit(teacher, '/profile/cv', 7_000);
check('filling a section in does not move the readiness number backwards',
  percentIn(cv) >= before);

// --------------------------------------------------------------- the preview
await press(teacher, 'Preview and download', 7_000);
check('the preview shows what was written', (await rendered(teacher)).includes(CORRECTED));
check('and offers something to take away', /PDF|Word|Download|Print/i.test(await text(teacher)));
await teacher.screenshot({ path: 'shots-audit/cv-preview.png', fullPage: true });

// ----------------------------------------------- who is allowed to read it
await visit(teacher, '/profile/cv', 6_000);
await open(teacher, 'Who can read it');
await press(teacher, 'People I apply to', 3_500);

const recruiter = await signIn('recruiter');
const shared = await visit(recruiter, `/applicant/${TEACHER}/cv`, 7_000);
check('a school they applied to is handed the CV',
  shared.includes('Shared with you by Grace Achieng'));
check('and it is the document the teacher wrote',
  (await rendered(recruiter)).includes(CORRECTED));
await recruiter.screenshot({ path: 'shots-audit/cv-recruiter.png', fullPage: true });

await visit(teacher, '/profile/cv', 6_000);
await open(teacher, 'Who can read it');
await press(teacher, 'Only me', 3_500);
check('the teacher can make it private',
  (await text(teacher)).includes('Nobody can open your CV here'));

await visit(recruiter, `/applicant/${TEACHER}/cv`, 7_000);
const refused = await text(recruiter);
check('and the recruiter loses it immediately', refused.includes('No CV to show'));
check('without being told why',
  !refused.includes('private') && !refused.includes('Only me'));

await finish();
