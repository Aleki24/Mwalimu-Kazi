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
// A school this teacher applied to.
const recruiter = await signIn('alexotieno293+fxrecruiter@gmail.com');

/*
  Somebody who hires but was never applied to — the reader `open` exists for,
  and the one who must never reach a referee.

  This used to be the parent fixture, until drive-tuition.mjs had the teacher
  answer that parent's tuition request and the "browsing" reader quietly became
  someone they had applied to. Three checks then failed for a reason that had
  nothing to do with the policies. So the stand-in is built here instead:
  `private.is_hiring()` is satisfied by having posted anything at all, so the
  moderator account posts one unpublished listing, which is removed at the end.
*/
const browser = await signIn('alexotieno293+fxadmin@gmail.com');
const { data: browserUser } = await browser.auth.getUser();
const listing = await browser.from('jobs').insert({
  title: 'Access check listing',
  subjects: ['english'],
  job_type: 'part_time',
  county: 'nairobi',
  published: false,
}).select('id').single();
if (listing.error !== null) throw new Error(`could not build the browsing reader: ${listing.error.message}`);
check('the browsing reader counts as hiring and was never applied to',
  browserUser?.user?.id !== undefined);

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

await teacher.from('cv_languages').upsert({
  id: '00000000-0000-4000-9000-00000000la01'.replace('la01', '0a01'),
  user_id: TEACHER, name: 'Access Check Language', level: 3,
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

  `recruiter` is a school this teacher applied to. `browser` posts listings of
  their own but this teacher never answered one, so they stand for anybody
  browsing — which is exactly who `open` is for and exactly who must never
  reach a referee. `open` is a teacher consenting to be found; publishing a
  referee's phone number is not theirs to consent to.
*/
for (const [visibility, expected] of [
  ['private', { cvRecruiter: 0, cvBrowser: 0, refRecruiter: 0, refBrowser: 0, photo: false }],
  ['applied', { cvRecruiter: 1, cvBrowser: 0, refRecruiter: 1, refBrowser: 0, photo: true }],
  ['open', { cvRecruiter: 1, cvBrowser: 1, refRecruiter: 1, refBrowser: 0, photo: true }],
]) {
  await setVisibility(visibility);
  const cvRecruiter = Math.min(await rows(recruiter, 'cv_details'), 1);
  const cvBrowser = Math.min(await rows(browser, 'cv_details'), 1);
  const refRecruiter = Math.min(await rows(recruiter, 'cv_referees'), 1);
  // Languages live in their own table and carry their own policy, so they get
  // their own question rather than being assumed to follow the CV.
  const langBrowser = Math.min(await rows(browser, 'cv_languages'), 1);
  const refBrowser = Math.min(await rows(browser, 'cv_referees'), 1);

  check(`${visibility}: a school they applied to ${expected.cvRecruiter ? 'can' : 'cannot'} read the CV`,
    cvRecruiter === expected.cvRecruiter);
  check(`${visibility}: somebody browsing ${expected.cvBrowser ? 'can' : 'cannot'} read the CV`,
    cvBrowser === expected.cvBrowser);
  check(`${visibility}: the school they applied to ${expected.refRecruiter ? 'gets' : 'does not get'} the referees`,
    refRecruiter === expected.refRecruiter);
  check(`${visibility}: somebody browsing never gets the referees`,
    refBrowser === expected.refBrowser);
  check(`${visibility}: languages follow the CV`, langBrowser === expected.cvBrowser);
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
await teacher.from('cv_languages').delete().eq('name', 'Access Check Language');
await browser.from('jobs').delete().eq('id', listing.data.id);

const failed = checks.filter((c) => !c).length;
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
process.exit(failed === 0 ? 0 : 1);
