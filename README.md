# Mwalimu Kazi

Teacher jobs and professional network for Kenya. Teachers find work before the
WhatsApp channels do, judge a school before accepting a job, and carry one
profile that every application reads from.

> Status: the domain model, match scoring, job search and the database are in
> place and tested against a live Supabase project. The mobile app is scaffolded
> but its screens are not built yet.

## Why it exists

Teaching vacancies in Kenya circulate through WhatsApp channels. If you are not
in the right group you hear late, and by the time you apply the shortlist is
closed. There is also no reliable way to find out what a school is actually like
before you accept a post there.

## What is here

```
packages/types   Zod schemas for the domain — the single source of truth.
                 Database types are generated into this package.
packages/core    Match scoring and Auto-Apply decisioning. Pure, no I/O, tested.
packages/ui      Design tokens shared by the mobile app and the web dashboard.
supabase/        Schema and RLS policies.
```

## The two functions that matter

**`matchScore(job, teacher)`** returns a 0–100 score plus a per-requirement
breakdown. The teacher's job card and the recruiter's candidate list both call
it — if they ever disagreed, the number would be worthless.

**`decideAutoApply(rule, job, match, ctx)`** decides whether to apply on a
teacher's behalf. An application cannot be recalled, so every rule is a gate and
anything uncertain skips with a reason the teacher can read back.

## Getting started

```bash
npm install
npx vitest run          # 136 tests
npx tsc --noEmit -p tsconfig.json
```

Copy `.env.example` to `.env` and fill in the project URL and publishable key
from the Supabase dashboard.

The schema in `supabase/migrations/` is already applied to the project, with
sample schools and vacancies from `supabase/seed.sql`. After any schema change,
regenerate the database types so queries stay checked:

```bash
npm run db:types        # rewrites packages/types/src/database.generated.ts
npm test                # the enum parity test fails if the two drift apart
```

## Dashboard settings the code cannot set

Four things live in the Supabase dashboard rather than in this repo, and the
app is wrong without them. They are listed here because a setting nobody wrote
down is a setting nobody can restore.

**1. Email confirmation — Authentication → Sign In / Providers → Email.**
Currently OFF, so sign-up returns a session immediately. Turn it back on once
SMTP works; the app already handles both, showing "check your email" only when
Supabase actually withholds the session.

**2. Redirect URLs — Authentication → URL Configuration.** Password reset
links land here, and an address that is not listed is silently dropped at the
site root with no token:

```
Site URL       https://mwalimu-kazi.vercel.app
Redirect URLs  https://mwalimu-kazi.vercel.app/**
               mwalimukazi://**
```

**3. Custom SMTP — Authentication → Emails → SMTP Settings.** Not optional
before real users. Supabase's built-in sender is rate-limited AND **refuses
any address that is not a member of the project's team** — a teacher resetting
a password gets "Email address not authorized" and no email at all. Any SMTP
provider works; Resend, Postmark and Twilio SendGrid are the ones Supabase
documents. What the form needs:

| Field | Notes |
| --- | --- |
| Host, Port | From the provider. 587 with STARTTLS is the usual choice |
| Username, Password | The provider's SMTP credentials, not your login |
| Sender email | `no-reply@yourdomain` — must be a domain you have verified |
| Sender name | `Mwalimu Kazi` |

The catch is the sender domain: providers will not let you send as
`@gmail.com`, so this needs a domain you own and can add DNS records to.
Without one, testing is limited to the provider's own sandbox domain, which
usually only delivers to the address you signed up with.

After setting it, raise the send limit under Authentication → Rate Limits —
it starts at 30 messages an hour to protect a new sender's reputation.

**4. Africa's Talking secrets** — only if SMS is revived. `send-sms` is still
deployed and still verifies its webhook signature, but nothing calls it now
that sign-in is by email.

## Stack

Turborepo with npm workspaces · Expo + expo-router + NativeWind (mobile) ·
Next.js + Tailwind + shadcn (web dashboard) · Supabase (Postgres, Auth,
Realtime, Storage, Edge Functions) · TypeScript in strict mode with Zod at
every boundary.

Note: NativeWind v4 pins Tailwind 3, so the mobile app is on Tailwind 3 while
the web app can use Tailwind 4.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the decisions behind that.
