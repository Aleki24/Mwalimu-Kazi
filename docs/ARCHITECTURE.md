# Architecture

## Decisions

**Supabase Auth over Clerk.** Phone/OTP sign-in matters in Kenya, and RLS
policies read `auth.uid()` directly — so document privacy and review anonymity
are enforced in Postgres rather than in application code. Clerk would mean
wiring JWT templates and carrying a second identity vendor.

**Row Level Security is the access-control layer.** Not a convenience on top of
app checks — the only layer. A teacher's Auto-Apply rules, their skipped-job
history and their documents are unreadable by any school, and no forgotten
`.eq('teacher_id', me)` in a query can change that.

**Match scoring lives in `packages/core`, not in the database or a screen.**
Teachers and recruiters must see the same number for the same pair. A pure
function with no I/O runs unchanged in the Expo app, the Next dashboard and an
Edge Function.

**A failed must-have caps the score at 49.** Auto-Apply's `minMatchScore` floors
at 50, so a hard requirement can never be auto-applied past no matter how strong
the rest of the profile is.

**Auto-Apply defaults to not sending.** A job with no advertised salary does not
clear a salary floor. Every skip is logged with a reason, because a teacher who
cannot see why they were passed over will not trust the feature.

**The red-flag taxonomy is closed.** Reviewers pick from a fixed list and must
supply evidence — `RedFlag.reason` has a 40-character minimum in the schema, not
just in the form. Free-text accusations are what make a review system
defamatory instead of useful.

**Match scores are frozen on the application row.** The teacher's profile keeps
changing; the school must see the match as it stood when they received it.

## Data flow

```
Teacher profile ─┐
                 ├─→ matchScore() ─→ score + breakdown ─→ job card / candidate list
Job requirements ┘                        │
                                          ↓
                        Auto-Apply rules → decideAutoApply() → apply | hold | skip(reason)
                                                                    │
                                                          auto_apply_events (audit)
```

**Private helpers live outside `public`.** PostgREST publishes every function in
`public` as an RPC endpoint, so `is_school_member()` was callable by anyone
before it moved to the `private` schema in migration 0002. Any future
`SECURITY DEFINER` helper goes there too, with a pinned `search_path`.

**`jobs` and `schools` are readable signed-out; everything else is not.**
Browsing vacancies before creating an account is the point. `profiles`,
`applications`, `auto_apply_rules`, `auto_apply_events` and `school_members`
have `SELECT` revoked from `anon` outright, so RLS is the second line rather
than the only one.

**One vocabulary, two declarations, one test.** The Postgres enums and the Zod
enums must agree; `packages/types/src/parity.test.ts` fails if they drift.

## Still to build

- Expo and Next.js app scaffolds
- Reviews, red flags and the moderation queue (schema migration 0002)
- Community, messaging and connections
- Job ingestion, push notifications, salary aggregation
