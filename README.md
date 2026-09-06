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
npx vitest run          # 49 tests
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

## Stack

Turborepo with npm workspaces · Expo + expo-router + NativeWind (mobile) ·
Next.js + Tailwind + shadcn (web dashboard) · Supabase (Postgres, Auth,
Realtime, Storage, Edge Functions) · TypeScript in strict mode with Zod at
every boundary.

Note: NativeWind v4 pins Tailwind 3, so the mobile app is on Tailwind 3 while
the web app can use Tailwind 4.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the decisions behind that.
