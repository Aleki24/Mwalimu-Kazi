/**
 * Drive the exported web build in a real browser, against the live project.
 *
 * Every bug in this app that mattered — dead filter chips, a download button
 * with no handler, `insert … returning` blocked by its own SELECT policy, a
 * bookmark that also opened the job, a feed with no way into it — passed
 * typecheck and passed the unit tests. This is the check that found them.
 *
 * Chromium in the dev sandbox has no network, so every Supabase request is
 * proxied through Node. That is the whole reason this file exists rather than
 * a plain Playwright script.
 *
 * Usage, with the root .env sourced:
 *   cd apps/mobile && npx expo export --platform web --output-dir /tmp/web
 *   node scripts/drive-app.mjs /tmp/web
 *
 * Fixtures come from supabase/fixtures/dev-seed.sql. Run that first, with the
 * same password in FIXTURE_PASSWORD that you set as `fixture.password` there.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const ROOT = resolve(process.argv[2] ?? '/tmp/web');
const PORT = Number(process.env.DRIVE_PORT ?? 4300);
/**
 * From the environment, never from this file.
 *
 * It was a literal here until GitGuardian flagged the commit that added it.
 * The accounts are throwaway and get deleted after every run, so there was
 * nothing to rotate — but a committed password is committed forever, and the
 * seed script it pairs with would recreate accounts anyone could sign into.
 */
const PASSWORD = process.env.FIXTURE_PASSWORD;
if (PASSWORD === undefined || PASSWORD === '') {
  console.error('Set FIXTURE_PASSWORD to the same value you passed to dev-seed.sql.');
  process.exit(2);
}
const ACCOUNTS = {
  teacher: 'alexotieno293+fxteacher@gmail.com',
  recruiter: 'alexotieno293+fxrecruiter@gmail.com',
  admin: 'alexotieno293+fxadmin@gmail.com',
};

const { chromium } = createRequire(import.meta.url)(
  process.env.PLAYWRIGHT_PATH ?? 'playwright',
);

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.ico': 'image/x-icon', '.png': 'image/png',
};

/**
 * Serve the export, falling back to index.html for every unknown path.
 *
 * The fallback is the SPA rewrite that Vercel does in production. Without it
 * a deep link 404s — which is exactly the bug a local harness that always
 * fell back had hidden until the real deploy broke.
 */
const server = createServer(async (req, res) => {
  const url = (req.url ?? '/').split('?')[0];
  for (const candidate of [join(ROOT, url), join(ROOT, url, 'index.html'), join(ROOT, 'index.html')]) {
    try {
      const body = await readFile(candidate);
      res.writeHead(200, { 'content-type': TYPES[extname(candidate)] ?? 'application/octet-stream' });
      res.end(body);
      return;
    } catch { /* try the next candidate */ }
  }
  res.writeHead(404).end('not found');
});

const checks = [];
const check = (label, ok) => {
  checks.push({ label, ok });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
};

await new Promise((r) => server.listen(PORT, r));
const browser = await chromium.launch();
const pageErrors = [];

async function signIn(who, width = 390) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => pageErrors.push(`[${who}] ${String(e).slice(0, 200)}`));
  await page.route('https://*.supabase.co/**', async (route) => {
    const request = route.request();
    try {
      const upstream = await fetch(request.url(), {
        method: request.method(),
        headers: request.headers(),
        body: request.postData() ?? undefined,
      });
      await route.fulfill({
        status: upstream.status,
        headers: { ...Object.fromEntries(upstream.headers.entries()), 'access-control-allow-origin': '*' },
        body: Buffer.from(await upstream.arrayBuffer()),
      });
    } catch {
      await route.abort();
    }
  });

  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' });
  await page.getByPlaceholder('you@example.com').waitFor({ timeout: 45_000 });
  await page.getByPlaceholder('you@example.com').fill(ACCOUNTS[who]);
  await page.getByPlaceholder('Your password').fill(PASSWORD);
  await page.getByText('Sign in', { exact: true }).click();
  await page.waitForTimeout(7_000);
  return page;
}

const text = async (page) => (await page.locator('body').innerText()).replace(/\s+/g, ' ');
const visit = async (page, route, wait = 4_500) => {
  await page.goto(`http://127.0.0.1:${PORT}${route}`, { waitUntil: 'load' });
  await page.waitForTimeout(wait);
  return text(page);
};

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

if (pageErrors.length > 0) {
  console.log([...new Set(pageErrors)].slice(0, 5).map((e) => `     ${e}`).join('\n'));
}
check('no uncaught page errors', pageErrors.length === 0);

await browser.close();
server.close();

const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
