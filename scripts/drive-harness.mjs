/**
 * The part of driving the app that is the same every time.
 *
 * There were three copies of this — one per drive script — and each had
 * already drifted: a different port, a different way of reading the password,
 * one that had lost the SPA fallback. The scripts differ in what they assert,
 * which is the only thing they should differ in.
 *
 * Two things here are not incidental:
 *
 *   * Chromium in the dev sandbox has no network, so every Supabase request is
 *     proxied through Node. That is the whole reason these are Node scripts
 *     serving a static export rather than a plain Playwright run.
 *
 *   * Unknown paths fall back to index.html, which is the SPA rewrite Vercel
 *     does in production — but only after trying the real file first. A
 *     harness that always fell back hid a deep-link 404 until the real deploy
 *     broke.
 *
 * Usage, with the root .env sourced:
 *   cd apps/mobile && npx expo export --platform web --output-dir /tmp/web
 *   FIXTURE_PASSWORD=… node scripts/drive-<name>.mjs /tmp/web
 *
 * Fixtures come from supabase/fixtures/dev-seed.sql. Run that first, with the
 * same password you pass in FIXTURE_PASSWORD.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.ico': 'image/x-icon', '.png': 'image/png',
};

/** The fixture accounts, by the word the scripts use for them. */
export const ACCOUNTS = {
  teacher: 'alexotieno293+fxteacher@gmail.com',
  recruiter: 'alexotieno293+fxrecruiter@gmail.com',
  admin: 'alexotieno293+fxadmin@gmail.com',
  parent: 'alexotieno293+fxparent@gmail.com',
};

/**
 * From the environment, never from a file in this repo.
 *
 * It was a literal in the seed script until GitGuardian flagged the commit
 * that added it. The accounts are throwaway and get deleted after every run,
 * so there was nothing to rotate — but a committed password is committed
 * forever, and the seed it pairs with would recreate accounts anyone could
 * sign into.
 */
function password() {
  const value = process.env.FIXTURE_PASSWORD;
  if (value === undefined || value === '') {
    console.error('Set FIXTURE_PASSWORD to the same value you passed to dev-seed.sql.');
    process.exit(2);
  }
  return value;
}

/**
 * Serve an export, open a browser, and hand back the few verbs a drive needs.
 *
 * `finish()` reports the tally and exits non-zero on any failure, so a drive
 * script is usable from CI without each one re-deriving that.
 */
export async function startHarness({ root, port } = {}) {
  const ROOT = resolve(root ?? process.argv[2] ?? '/tmp/web');
  const PORT = Number(port ?? process.env.DRIVE_PORT ?? 4300);
  const PASSWORD = password();

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
  await new Promise((r) => server.listen(PORT, r));

  const { chromium } = createRequire(import.meta.url)(
    process.env.PLAYWRIGHT_PATH ?? 'playwright',
  );
  const browser = await chromium.launch();

  const checks = [];
  const pageErrors = [];

  const check = (label, ok) => {
    checks.push({ label, ok });
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
  };

  async function signIn(who, width = 390) {
    const email = ACCOUNTS[who] ?? who;
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
          headers: {
            ...Object.fromEntries(upstream.headers.entries()),
            'access-control-allow-origin': '*',
          },
          body: Buffer.from(await upstream.arrayBuffer()),
        });
      } catch {
        await route.abort();
      }
    });

    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' });
    await page.getByPlaceholder('you@example.com').waitFor({ timeout: 45_000 });
    await page.getByPlaceholder('you@example.com').fill(email);
    await page.getByPlaceholder('Your password').fill(PASSWORD);
    await page.getByText('Sign in', { exact: true }).click();
    await page.waitForTimeout(7_000);
    return page;
  }

  const text = async (page) => (await page.locator('body').innerText()).replace(/\s+/g, ' ');

  /**
   * Type into a field by its placeholder, with real key events.
   *
   * `fill()` sets the DOM value and dispatches an input event, which React
   * Native Web picks up on most of this app's inputs and, reproducibly, not on
   * the one in `components/list-editor.tsx` — the value lands in the DOM and
   * the component's state never hears about it, so the Add button stays
   * disabled and the test looks like an app bug. Key events go through the
   * same path a person's keyboard does, which is what a drive script should be
   * exercising anyway.
   */
  const type = async (page, placeholder, value) => {
    const field = page.getByPlaceholder(placeholder, { exact: true }).first();
    await field.click();
    await field.fill('');
    await field.pressSequentially(value, { delay: 12 });
  };

  const visit = async (page, route, wait = 4_500) => {
    await page.goto(`http://127.0.0.1:${PORT}${route}`, { waitUntil: 'load' });
    await page.waitForTimeout(wait);
    return text(page);
  };

  async function finish() {
    if (pageErrors.length > 0) {
      console.log([...new Set(pageErrors)].slice(0, 5).map((e) => `     ${e}`).join('\n'));
    }
    check('no uncaught page errors', pageErrors.length === 0);
    await browser.close();
    server.close();
    const failed = checks.filter((c) => !c.ok);
    console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
    process.exit(failed.length === 0 ? 0 : 1);
  }

  return { check, signIn, text, type, visit, finish, port: PORT };
}
