/**
 * The four fixture accounts, made the way a real person makes one.
 *
 * `supabase/fixtures/dev-seed.sql` used to insert straight into `auth.users`,
 * which meant it needed the password, which meant the password had to reach
 * whatever ran the file — a session variable, a shell history, a paste into a
 * tool call. It was committed as a literal once already and GitGuardian was
 * right to flag it.
 *
 * This signs the accounts up through `/auth/v1/signup`, the same public
 * endpoint the app's own onboarding uses, reading FIXTURE_PASSWORD from the
 * gitignored root `.env`. The password never leaves that file: not into the
 * SQL, not into an argument, not into anything printed here.
 *
 * Usage, with the root .env sourced:
 *   node scripts/seed-fixture-accounts.mjs
 *   # then run supabase/fixtures/dev-seed.sql, which looks these up by email
 *
 * Re-runnable. An account that already exists comes back as "already there"
 * rather than an error — but its password is whatever it was set to the first
 * time, so if sign-in later fails, delete the four accounts and run this again.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const password = process.env.FIXTURE_PASSWORD;

if (!url || !key || !password) {
  console.error('Source the root .env first; it must carry FIXTURE_PASSWORD.');
  process.exit(2);
}

/** The same four the drive scripts name. Kept in step with drive-harness.mjs. */
const ACCOUNTS = [
  'alexotieno293+fxteacher@gmail.com',
  'alexotieno293+fxrecruiter@gmail.com',
  'alexotieno293+fxadmin@gmail.com',
  'alexotieno293+fxparent@gmail.com',
];

const post = (path, body) => fetch(`${url}/auth/v1${path}`, {
  method: 'POST',
  headers: { apikey: key, 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

let failed = 0;
for (const email of ACCOUNTS) {
  const signup = await post('/signup', { email, password });

  if (signup.ok) {
    console.log(`  ${email}: created`);
    continue;
  }

  /*
    Already registered. Sign-up will not reset a password, so the only useful
    thing left is to say whether the one in .env still opens it — a silent
    "already there" on an account with a forgotten password is exactly the
    failure this script exists to make impossible.
  */
  const signin = await post('/token?grant_type=password', { email, password });
  if (signin.ok) {
    console.log(`  ${email}: already there, and .env still opens it`);
  } else {
    console.log(`  ${email}: already there, and .env does NOT open it — delete it and re-run`);
    failed += 1;
  }
}

if (failed > 0) {
  console.error(`\n${failed} account(s) exist with a different password.`);
  console.error('Delete them (auth.users where email like \'alexotieno293+fx%@gmail.com\') and run this again.');
  process.exit(1);
}
console.log('\nAccounts ready. Now run supabase/fixtures/dev-seed.sql.');
