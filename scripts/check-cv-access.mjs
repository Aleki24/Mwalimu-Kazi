/**
 * Who can actually read a CV, asked of the live project rather than of the SQL.
 *
 * The visibility rules are four policies and three SECURITY DEFINER functions,
 * and every one of them was written by someone who believed it was correct.
 * Two were not:
 *
 *   * `cv_referees` originally ignored `visibility` entirely, so a teacher who
 *     had set their CV to private still handed their referees' phone numbers
 *     to every school they had applied to.
 *
 *   * the photograph was fetched from a stable object URL, and Cloudflare
 *     answered it from cache — `cf-cache-status: HIT` — for up to an hour
 *     after the teacher revoked access. The policy refused a fresh request and
 *     the CDN served the stale one anyway.
 *
 * Neither was visible in the migration, in a type, or in a unit test. This
 * runs the questions against the real thing.
 *
 * Usage, with the root .env sourced and the fixtures seeded:
 *   FIXTURE_PASSWORD=… node scripts/check-cv-access.mjs
 */
import { createRequire } from 'node:module';

const { createClient } = createRequire(import.meta.url)('@supabase/supabase-js');

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const PASSWORD = process.env.FIXTURE_PASSWORD;
if (!URL || !KEY || !PASSWORD) {
  console.error('Source the root .env and set FIXTURE_PASSWORD.');
  process.exit(2);
}

const TEACHER = '00000000-0000-4000-8000-0000000000f1';
const RECRUITER_FOLDER = '00000000-0000-4000-8000-0000000000f2';

const checks = [];
const check = (label, ok) => {
  checks.push(ok);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
};

async function signIn(email) {
  const client = createClient(URL, KEY, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error !== null) throw new Error(`${email}: ${error.message}`);
  return client;
}

/** A 1×1 PNG. Small enough to be free, real enough for the mime check. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const teacher = await signIn('alexotieno293+fxteacher@gmail.com');
// A school this teacher applied to, and someone who posts listings but not one
// this teacher ever answered.
const recruiter = await signIn('alexotieno293+fxrecruiter@gmail.com');
const parent = await signIn('alexotieno293+fxparent@gmail.com');

const setVisibility = async (visibility) => {
  const { error } = await teacher.from('cv_details').upsert({ user_id: TEACHER, visibility });
  if (error !== null) throw new Error(error.message);
  // The policies are STABLE functions over freshly committed rows; a moment
  // avoids racing the write rather than papering over a caching bug.
  await new Promise((r) => setTimeout(r, 800));
};

// A referee to ask about. Without one, "referees are held back" passes for the
// wrong reason — there was nothing to hold back.
const REFEREE = '00000000-0000-4000-9000-00000000ref1'.replace('ref1', '0ef1');
await teacher.from('cv_referees').upsert({
  id: REFEREE, user_id: TEACHER, name: 'Access Check Referee', phone: '0700000000',
});

const path = `${TEACHER}/check-${Date.now()}.png`;
const upload = await teacher.storage.from('cv-photos')
  .upload(path, PNG, { contentType: 'image/png', cacheControl: '0' });
check('a teacher can upload into their own folder', upload.error === null);

const elsewhere = await teacher.storage.from('cv-photos')
  .upload(`${RECRUITER_FOLDER}/portrait.png`, PNG, { contentType: 'image/png' });
check('and not into anybody else’s', elsewhere.error !== null);

/** Can this client get at the photograph at all? Signing is the access check. */
const canSeePhoto = async (client) => {
  const signed = await client.storage.from('cv-photos').createSignedUrl(path, 60);
  if (signed.error !== null || signed.data === null) return false;
  const response = await fetch(signed.data.signedUrl);
  return response.ok;
};

const rows = async (client, table) => {
  const { data } = await client.from(table).select('*').eq('user_id', TEACHER);
  return (data ?? []).length;
};

/*
  Two readers, because they are the two different questions.

  `recruiter` is a school this teacher applied to. `parent` posts listings of
  their own but this teacher never answered one, so they stand for anybody
  browsing — which is exactly who `open` is for and exactly who must never
  reach a referee. `open` is a teacher consenting to be found; publishing a
  referee's phone number is not theirs to consent to.
*/
for (const [visibility, expected] of [
  ['private', { cvRecruiter: 0, cvParent: 0, refRecruiter: 0, refParent: 0, photo: false }],
  ['applied', { cvRecruiter: 1, cvParent: 0, refRecruiter: 1, refParent: 0, photo: true }],
  ['open', { cvRecruiter: 1, cvParent: 1, refRecruiter: 1, refParent: 0, photo: true }],
]) {
  await setVisibility(visibility);
  const cvRecruiter = Math.min(await rows(recruiter, 'cv_details'), 1);
  const cvParent = Math.min(await rows(parent, 'cv_details'), 1);
  const refRecruiter = Math.min(await rows(recruiter, 'cv_referees'), 1);
  const refParent = Math.min(await rows(parent, 'cv_referees'), 1);

  check(`${visibility}: a school they applied to ${expected.cvRecruiter ? 'can' : 'cannot'} read the CV`,
    cvRecruiter === expected.cvRecruiter);
  check(`${visibility}: somebody browsing ${expected.cvParent ? 'can' : 'cannot'} read the CV`,
    cvParent === expected.cvParent);
  check(`${visibility}: the school they applied to ${expected.refRecruiter ? 'gets' : 'does not get'} the referees`,
    refRecruiter === expected.refRecruiter);
  check(`${visibility}: somebody browsing never gets the referees`,
    refParent === expected.refParent);
  check(`${visibility}: the photograph is ${expected.photo ? 'reachable' : 'refused'}`,
    (await canSeePhoto(recruiter)) === expected.photo);
}

// The one that was wrong: revoking has to bite now, not when a cache expires.
await setVisibility('open');
check('a shared photograph is reachable', await canSeePhoto(recruiter));
await setVisibility('private');
check('and is refused immediately once the CV is private', !(await canSeePhoto(recruiter)));

await setVisibility('applied');
await teacher.storage.from('cv-photos').remove([path]);
await teacher.from('cv_referees').delete().eq('id', REFEREE);

const failed = checks.filter((c) => !c).length;
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
process.exit(failed === 0 ? 0 : 1);
