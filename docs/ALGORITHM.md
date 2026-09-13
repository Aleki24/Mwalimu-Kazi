# Mwalimu Kazi — The Algorithm

The flowchart in [`SYSTEM_FLOWCHART.md`](SYSTEM_FLOWCHART.md) draws the control
flow. This is the same system written out as procedures: signatures, ordered
steps, the exact constants, the invariant each step protects, and the cost of
running it.

Everything here is read off the implementation — `packages/core` for the pure
decisions, `apps/mobile/lib` for the I/O, `supabase/migrations` for what
Postgres enforces regardless of the client. Where the pseudocode and the code
disagree, the code is right and this file is a bug.

## Notation

```
procedure NAME(arg: Type, …) -> ReturnType     a named algorithm
  ▸ invariant …                                a property that must hold
  ▹ cost …                                     time cost in n = input size
  ⟂ refused                                    the database rejects it
  ⇢ side effect                                a write, a notification, a file
```

`⌊x⌉` is `Math.round(x)`. `A ⊓ B` is "the two lists share a member, compared
case- and whitespace-insensitively". `now` is always injected, never read from
the clock inside a pure function.

---

## 0. The state the algorithm runs over

```
TeacherProfile   id, fullName, headline?, county, subjects[≥1], curricula[],
                 experienceYears 0..60, hasDegree, tscNumber? (4–9 digits),
                 tscVerified, openToOpportunities, notificationSound, skills[≤20]

Job              id, schoolId?, title, subjects[≥1], jobType, county,
                 salary? {min, max?}, ratePeriod, requirements[],
                 postedAt, closesAt?, engagement, meetsOnline,
                 meetsAtStudent, meetsAtTeacher, level?, posterRole?,
                 preferredGender?, prefersLocality?, area?, learnerLevel?,
                 sessionsPerWeek? 1..14, postedByName?

JobRequirement   kind ∈ {subject, qualification, experience_years,
                         tsc_registration, curriculum, county},
                 value, label, weight ∈ (0,10], mustHave

AutoApplyRule    enabled, subjects[≥1], counties[≥1], minSalary?,
                 minMatchScore 50..100 (default 85), jobTypes[],
                 excludedSchoolIds[], dailyLimit 1..20 (default 5),
                 weeklyLimit 1..100 (default 20), requireReviewBeforeSending

Application      jobId, teacherId, stage, source ∈ {manual, auto_apply},
                 matchScore 0..100 (frozen), createdAt
                 UNIQUE (teacherId, jobId)

SchoolReview     schoolId, authorId, body 40..4000, ratings[≥1],
                 redFlags[≤4] each with reason 40..1000,
                 moderation ∈ {pending, approved, rejected},
                 employmentVerified          UNIQUE (schoolId, authorId)
```

Four invariants hold across every procedure below.

- **I1 — One matcher.** Any score shown to a teacher and any score shown to a
  recruiter for the same `(job, teacher)` pair is the output of the same call to
  `MATCH-SCORE`. No SQL, no screen and no Edge Function recomputes it.
- **I2 — Frozen where it is a record.** `Application.matchScore` is written once
  and never updated. Every other displayed score is recomputed on read.
- **I3 — The database is the access-control layer.** No procedure filters by
  owner id for safety; RLS does. A missing `.eq('teacher_id', me)` cannot leak
  anything.
- **I4 — Nobody asserts their own trust signal.** `moderation`,
  `schools.verification` and `profiles.tsc_verified` are refused to the party
  they benefit.

---

## 1. The master algorithm

```
procedure SESSION() -> never
  1  flags ← READ-URL-FRAGMENT()          ▸ before createClient consumes it
  2  client ← CREATE-CLIENT(url, publishableKey, flags)
  3  loop forever
  4      status ← RESOLVE-STATUS()        § 2
  5      case status of
  6          loading             → hold the splash screen
  7          signed-out          → AUTHENTICATE()                § 3
  8          recovering          → SET-PASSWORD()                § 3.3
  9          needs-onboarding    → CREATE-PROFILE()              § 3.4
 10          profile-unreadable  → REPORT-FAULT(); offer sign out
 11          ready               → SERVE(profile)                § 4 onward
 12      wait for the next auth event or user action
```

`SERVE` is not a sequence — it is whichever surface the teacher opens. Every
one of them is a procedure below.

---

## 2. Resolving the session

```
procedure RESOLVE-STATUS() -> AuthStatus
  1  if not sessionResolved            → return loading
  2  if session = ∅                    → return signed-out
  3  if recovering                     → return recovering   ▸ tested BEFORE the
                                                               profile checks, or a
                                                               reset link lands on Home
  4  if not profileResolved            → return loading
  5  if profile ≠ ∅                    → return ready
  6  if profileFault = ∅               → return needs-onboarding
  7  else                              → return profile-unreadable
```

```
procedure LOAD-PROFILE(userId) -> (profile?, fault?)
  1  row ← SELECT * FROM profiles WHERE id = userId          ▸ RLS: own row
  2  if row = ∅                → (∅, ∅)          ▸ first sign-in, not a failure
  3  r ← TeacherProfile.safeParse(row)
  4  if r.ok                   → (r.value, ∅)
  5  else                      → (∅, r.reason)   ▸ a row that exists and disagrees
                                                   with the schema is a fault to
                                                   report, not a user to onboard
  ▸ never clears profileResolved on a refresh: dropping status to `loading`
    unmounts the guarded stack and throws the teacher back to Home
```

---

## 3. Credentials

```
procedure SIGN-IN(email, password) -> Outcome
  1  return signInWithPassword(lowercase(trim(email)), password)
     ▸ the phone keyboard capitalises; Supabase stores lowercase. Without the
       fold a teacher is told their own password is wrong.

procedure SIGN-UP(email, password) -> Outcome
  1  if |password| < 6                       → fail "Use at least 6 characters"
  2  r ← signUp(lowercase(trim(email)), password)
  3  if r.session = ∅                        → ok, needsConfirmation
     ▸ email confirmation is currently OFF in the project, so this branch is the
       one taken once it is switched on. The account exists and cannot be used
       yet; reporting that as a failure would be a lie.
  4  else                                    → ok

procedure REQUEST-RESET(email) -> Outcome
  1  redirect ← web ? origin + "/reset-password" : appScheme("/reset-password")
  2  resetPasswordForEmail(lowercase(trim(email)), redirect)
     ▸ an address not listed under Auth → URL Configuration is dropped at the
       site root with no token

procedure SET-PASSWORD(password) -> Outcome         § 3.3
  1  if |password| < 6                       → fail
  2  updateUser({ password }); recovering ← false

procedure CREATE-PROFILE(form) -> Outcome           § 3.4
  1  validate against TeacherProfile (county ∈ the 47, subjects ≥ 1, …)
  2  ⇢ INSERT profiles                       → status becomes ready
```

---

## 4. Retrieving jobs

```
procedure FETCH-OPEN-JOBS() -> (jobs: JobWithSchool[], skipped: string[])
  1  rows ← SELECT JOB_SELECT FROM jobs
            WHERE published
            ORDER BY posted_at DESC
            LIMIT 100                              ▸ RLS: jobs_select_visible
  2  return PARSE-JOBS(rows)

procedure PARSE-JOBS(rows) -> (jobs, skipped)
  1  jobs ← [], skipped ← []
  2  for each row
  3      r ← Requirements.safeParse(row.requirements)   ▸ STRICT
  4      if ¬r.ok → skipped ← skipped + reason; continue
  5      j ← Job.safeParse(row + salaryBand(row.salary_min, row.salary_max))
  6      if ¬j.ok → skipped ← skipped + reason; continue
  7      jobs ← jobs + { job: j, schoolName, schoolSlug, schoolType,
                         schoolCurricula, schoolVerification, posterKind }
  8  return (jobs, skipped)
  ▸ a malformed requirement fails the WHOLE row. Dropping just the bad entries
    would silently raise the score by deleting requirements the teacher does not
    meet — and a dropped mustHave would let Auto-Apply send what every rule was
    written to block.
  ▹ O(n) in rows

procedure SALARY-BAND(min?, max?) -> SalaryBand?
  1  if min = ∅ ∧ max = ∅            → ∅
  2  floor ← min ?? max              ▸ a lone ceiling becomes the floor; inventing
                                       a minimum of 0 would clear any salary rule
  3  return max ≠ ∅ ∧ max ≠ floor ? {min: floor, max} : {min: floor}
```

### 4.1 Keyset pagination

```
procedure FETCH-PAGE(cursor?) -> (jobs, skipped, next?)
  1  q ← SELECT … WHERE published
         ORDER BY posted_at DESC, id DESC LIMIT 20
  2  if cursor ≠ ∅
  3      q ← q AND (posted_at < cursor.postedAt
                    ∨ (posted_at = cursor.postedAt ∧ id < cursor.id))
  4  rows ← q; (jobs, skipped) ← PARSE-JOBS(rows)
  5  next ← |rows| < 20 ? ∅ : (last(rows).posted_at, last(rows).id)
     ▸ from the last ROW, not the last parsed job: an unparseable row still
       occupies a position, and skipping it re-fetches everything after it forever
  ▸ (posted_at, id) is unique and totally ordered, so a job published mid-scroll
    cannot duplicate a row the way OFFSET would
```

---

## 5. Filtering — the teacher's instructions

```
procedure FILTER-JOBS(entries, f: JobFilters) -> JobWithSchool[]
  keep entry ⟺ every supplied clause holds; an omitted clause is not a constraint

  1  f.subjects      : job.subjects ⊓ f.subjects
  2  f.counties      : job.county ∈ f.counties
  3  f.jobTypes      : job.jobType ∈ f.jobTypes
  4  f.engagements   : job.engagement ∈ f.engagements
  5  f.meetsOnline   : job.meetsOnline            ▸ only when asked for TRUE
  6  f.meetsAtStudent: job.meetsAtStudent
  7  f.schoolTypes   : entry.schoolType ≠ ∅ ∧ entry.schoolType ∈ f.schoolTypes
                       ▸ a listing with no school cannot answer a question about
                         schools, so it is excluded rather than let through
  8  f.curricula     : entry.schoolCurricula ⊓ f.curricula
  9  f.minSalary     : job.salary = ∅ ∨ (job.salary.max ?? min) ≥ f.minSalary
                       ▸ an unpriced job is KEPT here and skipped in Auto-Apply:
                         browsing is reversible, an application is not
 10  f.maxExperience : REQUIRED-EXPERIENCE(job) = ∅ ∨ ≤ f.maxExperienceYears
 11  f.tscOnly       : ∃ requirement of kind tsc_registration
 12  f.query         : q ⊆ title ∨ q ⊆ schoolName ∨ ∃ subject with q ⊆ subject
  ▹ O(n · |filters|)
```

---

## 6. Ranking — our opinion about order

```
procedure RANK-JOBS(entries, teacher, now) -> RankedJob[]
  1  scored ← [ entry + { match: MATCH-SCORE(entry.job, teacher) } ]
  2  sort by, in order:
        a. match.score          DESC
        b. closesAt             ASC   (absent = +∞)
        c. postedAt             DESC
  3  drop every entry with closesAt ≤ now
  ▸ (b) beats (c) deliberately: hearing about a vacancy after the shortlist closed
    is the problem this product exists to solve
  ▹ O(n log n), one MATCH-SCORE per entry

procedure CLOSING-SOON(entries, now, hours = 24) -> JobWithSchool[]
  1  return entries with now < closesAt ≤ now + hours·3600·1000
```

Ranking is never used as a filter: a job the teacher asked to see cannot be
removed by our ordering, only placed lower.

---

## 7. `MATCH-SCORE` — the number both sides see

```
constants
  CREDIT[met] = 1.0   CREDIT[partial] = 0.5   CREDIT[missing] = 0
  MUST_HAVE_FAIL_CAP = 49
```

```
procedure MATCH-SCORE(job, teacher) -> MatchResult
  1  if |job.requirements| = 0 → return BASELINE-SCORE(job, teacher)
  2  results ← [ EVALUATE(r, teacher) for r ∈ job.requirements ]   ▸ 1:1, index-aligned
  3  earned   ← Σ over i of  job.requirements[i].weight × CREDIT[results[i].status]
  4  possible ← Σ over i of  job.requirements[i].weight
  5  raw ← possible = 0 ? 0 : ⌊earned / possible × 100⌉
  6  blocked ← ∃ i : requirements[i].mustHave ∧ results[i].status = missing
  7  score ← blocked ? min(raw, 49) : raw
  8  return { score, blocked, requirements: results,
              metCount: |{ met }|, totalCount: |results| }
  ▹ O(m) in requirements; no I/O, no clock, no randomness — the same inputs
    always give the same number on every device
```

```
procedure EVALUATE(r, teacher) -> (status, detail)
  subject           : teacher.subjects ∋ r.value           → met | missing
  qualification     : r.value = "degree" ? teacher.hasDegree : teacher.skills ∋ r.value
                                                            → met | missing
  experience_years  : k ← parseInt(r.value)
                      k unparseable                        → missing
                      teacher.experienceYears ≥ k          → met
                      teacher.experienceYears ≥ k − 1      → partial
                      otherwise                            → missing
  tsc_registration  : tscNumber = ∅                        → missing
                      tscVerified                          → met
                      otherwise                            → partial
  curriculum        : teacher.curricula ∋ r.value          → met | missing
  county            : teacher.county = r.value             → met | missing
  ▸ comparison is trim + lowercase throughout, so "Kiswahili " matches "kiswahili"
```

```
procedure BASELINE-SCORE(job, teacher) -> MatchResult
  1  subjectHit ← job.subjects ⊓ teacher.subjects
  2  countyHit  ← job.county = teacher.county
  3  score ← ⌊(subjectHit + countyHit) / 2 × 100⌉ ; blocked ← false
  ▸ without this an unstructured job divides by zero and reads as a 0% match
```

**Why 49.** `AutoApplyRule.minMatchScore` has a floor of 50, so a capped score is
strictly below every threshold a teacher can set. A failed hard requirement can
never be auto-applied past, whatever else the profile brings.

---

## 8. Profile strength

```
procedure PROFILE-STRENGTH(teacher, cv) -> { percent, missing[] }
  items (weight, done-condition)
     20  Add your TSC number              tscNumber ≠ ∅
     15  List the subjects you teach      |subjects| > 0
     15  Add work experience to your CV   cv.experienceCount > 0
     15  Add your qualifications          cv.educationCount > 0
     10  Write a short personal statement cv.hasSummary
     10  Add a referee                    cv.refereeCount > 0
      8  Say which curricula you know     |curricula| > 0
      7  Add a headline                   trim(headline) ≠ ""
  1  percent ← ⌊Σ done·weight / 100 × 100⌉
  2  missing ← undone items sorted by weight DESC     ▸ the order to fix them in
  ▸ weighted by what changes outcomes, not by field count: TSC registration is a
    hard gate in MATCH-SCORE, and no amount of biography compensates
  ▸ every item is reachable from a screen that exists
```

---

## 9. `DECIDE-AUTO-APPLY` — thirteen gates, in this order

```
procedure DECIDE-AUTO-APPLY(rule, job, match, ctx) -> apply | hold_for_review | skip(reason)
   1  ¬rule.enabled                                   → skip disabled
   2  ctx.alreadyApplied                              → skip already_applied
   3  job.closesAt ≠ ∅ ∧ job.closesAt ≤ ctx.now       → skip job_closed
   4  job.schoolId = ∅                                → skip unverified_poster
   5  job.schoolId ∈ rule.excludedSchoolIds           → skip excluded_school
   6  ¬(job.subjects ∩ rule.subjects)                 → skip subject_mismatch
   7  job.county ∉ rule.counties                      → skip county_mismatch
   8  rule.jobTypes ≠ [] ∧ job.jobType ∉ rule.jobTypes → skip job_type_mismatch
   9  rule.minSalary ≠ ∅ ∧ job.salary = ∅             → skip below_min_salary
  10  rule.minSalary ≠ ∅ ∧ (salary.max ?? min) < rule.minSalary
                                                      → skip below_min_salary
  11  match.blocked                                   → skip must_have_unmet
  12  match.score < rule.minMatchScore                → skip below_min_match
  13  ctx.sentToday    ≥ rule.dailyLimit              → skip daily_limit_reached
  14  ctx.sentThisWeek ≥ rule.weeklyLimit             → skip weekly_limit_reached
  15  rule.requireReviewBeforeSending                 → hold_for_review
  16  otherwise                                       → apply
```

Four properties of that ordering, each deliberate:

- **Cheapest and most decisive first**, so the logged reason is the useful one
  rather than an incidental later failure.
- **Gate 4 has no override.** Auto-Apply sends a teacher's documents without them
  reading the listing; that is only defensible with a verified institution on the
  other end. A listing with no school is never sent to automatically, whatever
  the rules say — the teacher can still apply by hand after reading it.
- **Gate 9 refuses silence.** A job that advertises no salary cannot clear a
  salary floor. Treating a missing band as "probably fine" is how teachers get
  auto-applied into roles paying less than they said they would accept.
- **Gate 10 compares against the ceiling.** If even `max` is under the teacher's
  floor, the role cannot pay what they asked for.

Every skip carries a machine reason and human wording (`SKIP_REASON_TEXT`), because
a teacher who cannot see why they were passed over will not trust the feature.

---

## 10. `RUN-AUTO-APPLY` — the runner

```
procedure RUN-AUTO-APPLY(teacher, ruleRow) -> { considered, applied, held, skipped }
   1  rule ← TO-RULE(ruleRow)
   2  if ¬rule.enabled → return zeroes
   3  now ← new Date()
   4  (jobs, appliedIds, sent) ← in parallel
          FETCH-OPEN-JOBS()
          SELECT job_id FROM applications                       ▸ RLS: mine
          SELECT created_at FROM auto_apply_events
             WHERE outcome = 'applied' AND created_at ≥ now − 7d
   5  sentThisWeek ← |sent| ; sentToday ← |{ s ∈ sent : s ≥ midnight(now) }|
      ▸ counted from the table, never from memory: closing the app must not reset
        a daily cap, and sending twice costs a teacher an interview
   6  events ← []
   7  for each entry ∈ jobs
   8      considered ← considered + 1
   9      match ← MATCH-SCORE(entry.job, teacher)          ▸ I1: the same matcher
  10      d ← DECIDE-AUTO-APPLY(rule, entry.job, match,
                                { now, alreadyApplied: entry.job.id ∈ appliedIds,
                                  sentToday, sentThisWeek })
  11      case d of
  12        skip(reason):
  13            skipped ← skipped + 1
  14            if reason ∈ { below_min_match, must_have_unmet }
  15                events ← events + { outcome: 'skipped', reason, match.score }
                  ▸ only the near misses. Nobody needs a line saying every job in
                    the wrong county was in the wrong county.
  16        hold_for_review:
  17            held ← held + 1 ; events ← events + { outcome: 'held' }
  18        apply:
  19            ⇢ INSERT applications { source: 'auto_apply', match_score: match.score }
  20            if error.code = 23505    → skipped ← skipped + 1 ; continue
                  ▸ already applied: the same outcome as the first time, not a failure
  21            if other error          → events + { outcome: 'failed', message } ; continue
  22            applied ← applied + 1 ; sentToday += 1 ; sentThisWeek += 1
                  ▸ incremented in the loop, so the caps hold WITHIN a run
  23            events ← events + { outcome: 'applied', match.score }
  24  if events ≠ [] → ⇢ INSERT auto_apply_events (one batch)
  25  return the summary
  ▹ O(n) MATCH-SCORE calls + one write per application + one batched event write
```

**Where this runs, and why.** The runner is the client: it evaluates when the
teacher opens the app, not overnight. `DECIDE-AUTO-APPLY` is the most
consequential function in the codebase, and a second copy of it in SQL or an
Edge Function is the one drift this system cannot afford — so the limit is
accepted and the screen states it plainly, because a teacher who believes it ran
while they slept has been misled by us rather than by the world.

---

## 11. Applying by hand

```
procedure APPLY-TO-JOB(teacherId, jobId, score) -> boolean
  1  ⇢ INSERT applications { teacher_id, job_id, match_score: score,
                             source: 'manual' }        ▸ stage defaults to 'applied'
  2  if no error        → true
  3  if code = 23505    → false          ▸ "you already applied", not an error
  4  otherwise          → throw
  ▸ I2: match_score is frozen here. The teacher's profile keeps changing; the
    school must see the match as it stood when they received it.
```

```
procedure SAVE-JOB(teacherId, jobId)      ⇢ INSERT saved_jobs; 23505 ignored
procedure UNSAVE-JOB(teacherId, jobId)    ⇢ DELETE saved_jobs
procedure COMMENT-ON-JOB(jobId, body)     ⇢ INSERT job_comments (attributed)
```

---

## 12. Posting a listing

```
procedure POST-JOB(draft) -> void
  1  ⇢ INSERT jobs { school_id, title, county, subjects, job_type,
                     salary_min, salary_max, engagement, rate_period,
                     meets_online, meets_at_student, meets_at_teacher,
                     area, learner_level, sessions_per_week, level,
                     poster_role, preferred_gender, prefers_locality,
                     published: true }
     ▸ posted_by and poster_kind are NEVER sent by the client

  Postgres then runs, in this order:

  2  CHECK jobs_attributable                 school_id ≠ ∅ ∨ posted_by ≠ ∅
  3  CHECK jobs_private_request_is_answerable a tuition / homeschool / assignment
                                              request must say how to answer it
  4  CHECK jobs_private_request_has_no_school a request can never carry a school,
                                              so it can never inherit a badge
  5  CHECK jobs_gender_preference_is_private_only
  6  BEFORE trigger set_job_provenance:
         posted_by   ← auth.uid()            ▸ a listing that can name someone else
                                               as its author is a forgery tool
         poster_kind ← school_id ≠ ∅ ? 'school'
                       : is_platform_admin() ? 'platform' : 'individual'
  7  RLS write policy, one of:
         jobs_write_school    is_school_member(school_id)
         jobs_write_own       posted_by = auth.uid() ∧ school_id = ∅
         jobs_write_platform  is_platform_admin()
     none match                              → ⟂ refused
  8  AFTER INSERT OR UPDATE OF published, WHEN (new.published)
         → NOTIFY-JOB-MATCH()                § 13
```

---

## 13. Notification fan-out

```
procedure NOTIFY-JOB-MATCH()  -- trigger on jobs
  1  schoolName ← name of new.school_id
  2  if schoolName = ∅ → return           ▸ an orphan listing has nothing to say
  3  salaryText ← min = ∅ ? "Salary not stated"
                : max = ∅ ? "From KSh {min}"
                :           "KSh {min}–{max}"
  4  ⇢ INSERT INTO notifications
         SELECT p.id, 'job_match', new.title,
                "{schoolName} · {County} · {salaryText}",
                { job_id, school_id }
         FROM profiles p
         WHERE p.open_to_opportunities
           AND p.subjects && new.subjects        ▸ array overlap
           AND p.county = new.county             ▸ county is the only location
                                                   signal a profile carries;
                                                   without it a Kisumu teacher
                                                   hears about the whole country
                                                   and stops reading notifications
           AND NOT EXISTS (member of the posting school)
         ON CONFLICT DO NOTHING
  ▸ no match score is stored: a score in SQL would be a second matcher (breaking
    I1) and would go stale the moment the profile changed. The client re-scores
    live on read.
  ▹ one set-based INSERT … SELECT per publish; O(matching teachers)
```

```
procedure READ-NOTIFICATIONS() -> feed
  1  items ← SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50
  2  ids ← distinct { payload.job_id : kind = 'job_match' ∧ typeof = string }
  3  jobs ← PARSE-JOBS(SELECT … WHERE id IN ids)         ▸ one batched round trip
  4  render: job_match → MATCH-SCORE live; message → open thread; other → as written
procedure MARK-ALL-READ()   ⇢ UPDATE notifications SET read_at = now() WHERE read_at IS NULL
```

---

## 14. The hiring side

```
procedure FETCH-MY-SCHOOLS() -> MySchool[]
  1  memberships ← SELECT role, schools(*) FROM school_members     ▸ RLS-scoped
  2  jobs ← published jobs at those schools
  3  applications ← SELECT job_id, stage FROM applications         ▸ RLS already
                                                                     limits this
  4  per school: openRoles = |jobs|, newApplicants = |{ stage = 'applied' }|

procedure FETCH-MY-POSTINGS(posterId) -> Job[]
  1  SELECT * FROM jobs WHERE posted_by = posterId AND school_id IS NULL
     ▸ the posted_by filter is not optional: jobs_select_published makes every
       published listing readable, so filtering on school_id alone would return
       every individual listing in the country as if it were yours

procedure FETCH-APPLICANTS(job) -> Applicant[]
  1  rows ← SELECT *, profiles(*) FROM applications WHERE job_id = job.id
  2  for each row
  3      teacher  ← parseTeacherProfile(row.profiles)          ▸ ∅ if it will not parse
  4      frozen   ← row.match_score        ▸ client-asserted; never trusted for ranking
  5      liveMatch← MATCH-SCORE(parse(job), teacher)           ▸ I1, recomputed here
  6  where the two disagree, the live one is the honest number

procedure SET-STAGE(applicationId, stage)
  ⇢ UPDATE applications SET stage = …       stages: saved → applied → viewed →
                                            shortlisted → interview → offered
                                            · rejected · withdrawn
```

---

## 15. Messaging

```
procedure OPEN-THREAD(applicationId) -> threadId
  1  t ← SELECT id FROM message_threads WHERE application_id = applicationId
  2  if t ≠ ∅ → return t
  3  ⇢ INSERT message_threads (application_id) RETURNING id
  4  if code = 23505 → re-SELECT and return it
     ▸ both sides may press at once; a unique violation means "someone else just
       made it", not a failure
  ▸ a thread hangs off an APPLICATION, never off a pair of people — so there is
    no way to open a channel to someone who has not chosen you

procedure SEND(threadId, senderId, body)
  1  ⇢ INSERT messages … ▸ RLS: is_thread_participant(threadId)
  2  AFTER INSERT → NOTIFY-MESSAGE()

procedure NOTIFY-MESSAGE()  -- trigger on messages
  1  resolve teacherId, schoolId, schoolName from thread → application → job
  2  if sender = teacher → ⇢ notify every member of the posting school,
                             titled with the teacher's name
  3  else                → ⇢ notify the teacher, titled with the school's name
  4  body ← first 140 characters ; payload ← { thread_id }

procedure MARK-THREAD-READ(threadId, viewerId)
  ⇢ UPDATE messages SET read_at = now()
    WHERE thread_id = … AND sender_id ≠ viewerId AND read_at IS NULL
    ▸ your own messages were never unread to you

procedure ATTRIBUTE(message) -> name
  return message.sender = teacherId ? teacherName : (schoolName ?? "The school")
  ▸ by SIDE, not by person: a recruiter's profile row is not readable by the
    teacher, so naming the individual would render "Unknown" on one side of
    every conversation — and naming the side stays right when a school has
    several people on the thread
```

---

## 16. Reviews

```
constants  bodyMin 40 · bodyMax 4000 · reasonMin 40 · reasonMax 1000
           maxRedFlags 4 · minRatings 1 · score ∈ [1,5] integer
           — every one of these is also a CHECK constraint in migration 0004
```

```
procedure VALIDATE-REVIEW-DRAFT(draft) -> Problem[]
  1  |ratings| < 1                                → "Rate at least one category."
  2  ∃ score ∉ ℤ ∩ [1,5]                          → "…whole number from 1 to 5."
  3  duplicate category                           → "Each category once."
  4  |trim(body)| < 40                            → "needs N more characters"
  5  |trim(body)| > 4000                          → "keep it under 4000"
  6  |redFlags| > 4                               → "at most four"
  7  duplicate red-flag kind                      → "each raised once"
  8  ∀ flag: |trim(reason)| < 40                  → "Say what happened — N more"
             |trim(reason)| > 1000                → "under 1000"
  9  return ALL problems, not the first
     ▸ a submit button that reveals one blocker at a time is a guessing game
```

```
procedure SUBMIT-REVIEW(draft) -> reviewId          -- RPC, one transaction
  1  ⟂ if |ratings| = 0 ∨ |redFlags| > 4           ▸ re-checked server-side
  2  ⇢ INSERT school_reviews (author_id = auth.uid(), moderation = 'pending')
  3  ⇢ INSERT review_ratings   (all rows)
  4  ⇢ INSERT review_red_flags (all rows)
  5  on 23505 → AlreadyReviewedError                ▸ one review per school per author
  ▸ one transaction, not three inserts from the client: a failure part way would
    leave a review with no ratings — a shape the domain schema says is impossible
  ▸ employmentVerified is deliberately not a parameter. It is what separates a
    review that carries weight from one that does not, so the client that
    benefits from it must not be able to assert it. (I4)
```

```
procedure AGGREGATE-SCHOOL-RATINGS(reviews) -> { overall, reviewCount, byCategory }
  1  perReview ← [ mean(r.ratings.score) for r ∈ reviews if r.ratings ≠ [] ]
  2  overall   ← perReview = [] ? ∅ : round1(mean(perReview))
     ▸ the mean of each REVIEW's average, NOT the mean of every rating: otherwise
       a thorough reviewer who scored ten categories counts more than three times
       as heavily as one who scored three — the loudest voice, not the commonest
       experience
  3  byCategory ← for each category actually rated:
         average = round1(mean of its scores), count = how many rated it
     ▸ averaged only over reviews that rated it, so a blank is absent, not a zero
  4  sort byCategory ASCENDING by average
     ▸ worst first: the reason a teacher opens this screen is to find the problems

procedure SUMMARISE-RED-FLAGS(reviews, now, months = 12) -> RedFlagCount[]
  1  cutoff ← now − months × 30 days
  2  for each flag: when ← flag.occurredOn ?? review.createdAt
  3      if when < cutoff → skip           ▸ old flags age out: a school that fixed
                                             its payroll two years ago should not
                                             carry it forever
  4  count by kind; sort by count DESC, then kind alphabetically
```

Reviews are anonymous; comments are attributed. Asking a public question about a
vacancy is a normal act — naming a bad employer under your own name is not safe.

---

## 17. Who may read a CV

```
procedure MAY-READ-CV(owner) -> boolean          -- SQL, SECURITY DEFINER, private schema
  1  owner = auth.uid()                                        → true
  2  auth.uid() = ∅                                            → false
  3  visibility = 'private'                                    → false
  4  visibility = 'applied' ∧ APPLIED-TO-ME(owner)             → true
  5  visibility = 'open'    ∧ (IS-HIRING() ∨ APPLIED-TO-ME(owner)) → true
  6  otherwise                                                 → false

procedure APPLIED-TO-ME(owner) -> boolean
  ∃ application a, job j : a.teacher_id = owner ∧ a.job_id = j.id
    ∧ ( j.posted_by = auth.uid()
        ∨ (j.school_id ≠ ∅ ∧ auth.uid() ∈ members(j.school_id)) )

procedure IS-HIRING() -> boolean
  auth.uid() ∈ any school_members  ∨  ∃ job with posted_by = auth.uid()
```

```
procedure FETCH-PHOTO(path) -> dataUri?
  1  signed ← createSignedUrl('cv-photos', path, 60s)   ▸ refused once policy stops allowing it
  2  bytes ← fetch(signed); base64 in 0x8000-byte chunks
     ▸ String.fromCharCode(...bytes) on a 2 MB photograph is a stack overflow
  3  return "data:{mime};base64,…"
  ▸ signed-and-inlined, never linked: download() hits a stable per-object URL that
    the CDN cached (measured cf-cache-status: HIT) and kept serving a portrait after
    the teacher went private. A fresh signature every time makes revocation immediate,
    and an inlined photo cannot break a week after the CV was emailed.
```

```
procedure EXPORT-CV(cv, style, format) -> shared | saved
  1  html ← format = 'pdf' ? renderCvHtml(cv, style) : renderCvWordHtml(cv, style)
     ▸ both formats come from ONE renderer, so the PDF and the Word file cannot
       show different things
  2  device: printToFile / write file → rename to "{name}-cv.{ext}" → share sheet
     ▸ the school receives grace-wanjiru-cv.pdf, not a3f9c1….pdf
  3  web: Blob → new tab → the browser's own print dialogue
  4  a cancelled share is a normal act, never an error
```

---

## 18. Home

```
procedure CAREER-SNAPSHOT(teacher) -> snapshot
  1  in parallel: applications (+ jobs, schools), cv_details.summary,
                  COUNT(cv_experience), COUNT(cv_education), COUNT(cv_referees)
     ▸ counts use head:true so no rows travel — this runs on every Home load,
       often on a phone paying for the data
  2  applications ← |rows|
     interviews   ← |{ stage ∈ { interview, offered } }|
                    ▸ interview is a stage, not a terminal state
     offers       ← |{ stage = offered }|
  3  strength ← PROFILE-STRENGTH(teacher, cvCounts)
  4  lead ← PICK-LEAD(rows)

procedure PICK-LEAD(rows) -> LeadApplication?
  rank: offered 6 · interview 5 · shortlisted 4 · viewed 3 · applied 2 · saved 1
        · rejected 0 · withdrawn 0
  1  skip any row whose job or school did not come back
     ▸ the hero card names a school out loud; naming none is worse than a fallback
  2  keep the highest rank, breaking ties by the most recent createdAt
  ▸ a closed application is not what to greet someone with, hence rank 0
```

Home then renders: hero (lead) · profile ring (strength) · top 2 ranked matches ·
closing-soon strip · Auto-Apply state · six quick actions. Every route without a
tab has to appear in the grid or the header, or it is unreachable.

---

## 19. Access control

RLS is evaluated by Postgres for every statement; the client never repeats it.

```
procedure MAY-SELECT(table, row) -> boolean
  profiles        own ∨ discoverable ∨ applicant to my school
                  ∨ applicant to a listing I posted ∨ platform admin
  jobs            published ∨ member of its school ∨ posted_by me ∨ platform admin
  applications    teacher_id = me ∨ member of the receiving school ∨ IS-JOB-POSTER
  auto_apply_*    own rows only          ▸ unreadable by any school
  saved_jobs      own rows only
  school_reviews  moderation = 'approved' ∨ author_id = me ∨ platform admin
  threads/messages IS-APPLICATION-PARTICIPANT / IS-THREAD-PARTICIPANT
  cv_*            MAY-READ-CV(owner)
  posts/comments  everyone reads; only you write as yourself
  anon            jobs, schools, news, resources — everything else has SELECT
                  revoked from anon outright, so RLS is the second line
```

```
▸ every SECURITY DEFINER helper lives in the `private` schema with a pinned
  search_path. PostgREST publishes every function in `public` as an RPC, so
  is_school_member() was callable by anyone until migration 0002 moved it.
▸ anon is granted EXECUTE on those helpers so a signed-out read evaluates to
  false and returns nothing, instead of failing the whole query with 42501.
```

```
procedure GUARD-TRUST-FLAGS()  -- BEFORE UPDATE on school_reviews, profiles, schools
  1  auth.uid() = ∅ (service role) ∨ is_platform_admin()   → allow
  2  school_reviews ∧ moderation changed  → ⟂ "a review is published by a
                                               moderator, not by its author"
  3  profiles ∧ tsc_verified changed      → ⟂ "TSC verification is granted by the
                                               platform, not by the teacher"
  4  schools ∧ verification changed       → ⟂ "a school does not verify itself"
  ▸ one condition per statement, nested: PL/pgSQL resolves the field reference even
    when the table test is false, so the flat form died with `record "new" has no
    field "moderation"` on every profile update
```

```
procedure ADMIN-QUEUES() -> { reviews, schools, tsc }
  reviews ← moderation = 'pending', oldest first
  schools ← verification ∈ { pending, under_review }
  tsc     ← tsc_number ≠ ∅ ∧ ¬tsc_verified
  ▸ no filter of their own beyond these: a non-admin gets EMPTY results, not an
    error, because the admin policies are doing the work
  ▸ approving a TSC number immediately changes every match score with a
    tsc_registration requirement — from partial to met (I1 again)
```

---

## 20. Lifecycle and verification

```
procedure DROP-UNATTRIBUTABLE-LISTINGS()  -- BEFORE DELETE on profiles
  1  ⇢ DELETE FROM jobs WHERE posted_by = old.id AND school_id IS NULL
     ▸ a household request whose household is gone is a dead end
  2  a school's vacancy keeps its row and loses its author (FK SET NULL);
     jobs_attributable is still satisfied by school_id
  ▸ without this, anyone who ever posted an individual listing could not be
    deleted at all — the delete hit the check constraint and raised 23514
```

```
procedure VERIFY-CHANGE()
  1  schema change → new migration → `npm run db:types` → parity.test.ts fails if a
                     Postgres enum and its Zod enum have drifted
  2  logic change  → unit tests beside the function in packages/core
  3  UI change     → design-guards.test.ts, three static rules over the source,
                     each of which has already shipped a bug
  4  CI on every push to main and every PR:
         npm install → npx tsc --noEmit → npx vitest run     (136 tests)
```

---

## Appendix A — constants

| Constant | Value | Where it binds |
| --- | --- | --- |
| `CREDIT` | met 1.0 · partial 0.5 · missing 0 | `MATCH-SCORE` |
| `MUST_HAVE_FAIL_CAP` | 49 | `MATCH-SCORE`, one below every Auto-Apply floor |
| `minMatchScore` | 50–100, default 85 | `AutoApplyRule` |
| `dailyLimit` / `weeklyLimit` | 1–20 default 5 / 1–100 default 20 | `AutoApplyRule` |
| Experience partial band | within 1 year of the bar | `EVALUATE` |
| Open-jobs read | 100 rows | `FETCH-OPEN-JOBS` |
| Jobs page / feed page | 20 rows, keyset | `FETCH-PAGE`, feed |
| Notifications read | 50 rows | `READ-NOTIFICATIONS` |
| Auto-Apply activity log | 30 rows | `fetchEvents` |
| Closing-soon window | 24 hours | `CLOSING-SOON` |
| Red-flag window | 12 months of 30 days | `SUMMARISE-RED-FLAGS` |
| Review body / red-flag reason | 40–4000 / 40–1000 characters | validator **and** CHECK |
| Red flags per review | ≤ 4, each kind once | validator **and** CHECK |
| Ratings | 1–5 integer, each category once | validator **and** primary key |
| Password floor | 6 characters | `SIGN-UP`, `SET-PASSWORD` |
| Message notification body | first 140 characters | `NOTIFY-MESSAGE` |
| Signed URL lifetime | 5 min (resources) · 60 s (CV photo) | storage reads |
| Profile-strength weights | 20 · 15 · 15 · 15 · 10 · 10 · 8 · 7 | `PROFILE-STRENGTH` |

## Appendix B — cost

| Procedure | Cost | Round trips |
| --- | --- | --- |
| `MATCH-SCORE` | O(m) in requirements | 0 — pure |
| `FILTER-JOBS` | O(n · filters) | 0 — pure |
| `RANK-JOBS` | O(n log n) + n × `MATCH-SCORE` | 0 — pure |
| `AGGREGATE-SCHOOL-RATINGS` | O(ratings) | 0 — pure |
| `SUMMARISE-RED-FLAGS` | O(flags) | 0 — pure |
| `FETCH-RANKED-JOBS` | O(n log n) | 1 |
| `RUN-AUTO-APPLY` | O(n) decisions | 3 parallel + 1 per application + 1 batch |
| `CAREER-SNAPSHOT` | O(applications) | 5 parallel, four of them count-only |
| `FETCH-CV` | O(rows) | 7 parallel |
| `NOTIFY-JOB-MATCH` | O(matching teachers) | 1 set-based INSERT … SELECT |
| `READ-NOTIFICATIONS` | O(50) | 2 — the second batches every referenced job |

## Appendix C — the decisions the algorithm exists to protect

1. **One matcher, one number.** (I1)
2. **A failed must-have caps at 49**, below every threshold a teacher can set.
3. **Auto-Apply defaults to not sending** — no salary, no school, no certainty
   means no application, and every skip is logged with a readable reason.
4. **Frozen where it is a record, live where it is a prompt.** (I2)
5. **RLS is the access-control layer**, not a convenience on top of app checks. (I3)
6. **Provenance is set by the database**, never claimed by the client.
7. **Nobody asserts their own trust signal.** (I4)
8. **A row that will not parse is dropped and reported**, never half-rendered and
   never silently rescored.
9. **The vocabularies are declared twice and tested once** — Postgres enums and
   Zod enums, with `parity.test.ts` failing on drift.
