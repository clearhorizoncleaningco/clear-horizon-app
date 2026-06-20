# CLAUDE.md — Clear Horizon Cleaning Co. Estimating Platform

This file is the standing instruction set for every Claude Code session in this repo. Read it before doing anything.

---

## 1. VERIFICATION PROTOCOL (applies to EVERY task, no exceptions)

**Before you start any work, state how you will verify it.**
- Name the specific check that will prove the work is correct: the exact command to run, the test that must pass, the URL/route to hit, or the precise output to expect.
- State the expected result *before* implementing, so "done" is defined up front.
- If something genuinely cannot be verified by running code, say so explicitly and give the exact manual steps I should perform to confirm it.

**After you finish, run the verification and report the results.**
- Actually execute the check you described. Paste the real, unedited output (test summary, command result, computed values).
- Report pass or fail honestly. **Do not claim success without showing evidence.** "It should work" is not verification — running it is.
- If it fails, say so plainly, diagnose, fix, and re-run until it passes (or escalate to me with what you found).

**Definition of "done"** = the verification you stated has been run and passed — not "the code is written."

This protocol overrides any urge to move fast. A task is incomplete until verified.

---

## 2. WHAT WE ARE BUILDING (and what we are NOT)

The product is an **internal estimating + proposal tool** whose v1 success test is: *the two owners can accurately quote jobs, and quotes get more accurate as real jobs are logged.* Full detail lives in `docs/BUILD_SPEC.md` — read it.

**Build/borrow boundary (do not violate):**
- **BUILD here (our IP):** the residential pricing engine, the estimate wizard, branded proposals, margin tracking, a manual commercial-quote path, and (later) light job tracking + a public quote widget.
- **BORROW from GoHighLevel:** contacts, pipeline, reminders, marketing. **Do not build CRM, pipeline, marketing, or lead-gen in this app.**
- **Handoff is ONE-WAY:** this app pushes a finished quote to GHL. GHL owns the pipeline; this app owns the quote. No two-way sync.

**Out of scope for v1 (do not build):** accounting/invoicing/payroll · scheduling/dispatch/route optimization · franchise/multi-owner admin UI · automated commercial pricing engine · two-way GHL sync.

When a request is ambiguous, **cut scope toward "ship the estimator"** rather than adding features.

---

## 3. NON-NEGOTIABLE ENGINEERING RULES

1. **No hardcoded pricing.** Every rate, multiplier, threshold, fee, and rule lives in the database, Admin-editable, seeded from the values in `docs/BUILD_SPEC.md` §E. If you find a magic number in pricing logic, that's a bug.
2. **The pricing engine is a pure, isolated, fully unit-tested module** (`lib/pricing/`). No pricing math in React components or API handlers — they call the service.
3. **Org-scoped from day one.** Every business record carries `organizationId` and is always filtered by the current user's org. (No franchise UI in v1 — just the data scoping.)
4. **Stop at phase checkpoints.** Build the current phase only. At its checkpoint, run the verification, report, and **wait for my sign-off** before starting the next phase.
5. **Margin/labor numbers are Admin-only** — never rendered to Office Staff, Cleaners, or customers.
6. **Strict TypeScript, Zod validation at every boundary, real error handling.** No `any` to dodge a type error.
7. **Comprehensive unit tests on the pricing engine**; lighter integration tests on APIs; skip full E2E for now.
8. I am **deploying this myself with limited time** — every setup/run/deploy step must be explicit and copy-paste-able.

---

## 4. STACK
Next.js (App Router) · TypeScript (strict) · Tailwind + shadcn/ui · Supabase (Postgres + Auth + Storage) · Prisma · Vercel · all free-tier. Auth: Supabase email/password + magic link. Roles: Admin, Office Staff, (stubbed) Cleaner.

---

## 5. THE PRICING FIXTURE (use as a permanent regression check)
A residential quote of **2,200 sq ft / 3 bed / 2.5 bath / biweekly / Naples / average condition / 1 pet / no add-ons** must produce: **base 5.0 hrs, production 5.625 hrs, base price $478.13, final rounded price $500.** If this ever changes, pricing logic has drifted — investigate before proceeding. Keep this as a unit test.

---

## 6. WORKING AGREEMENTS
- Commit at the end of every verified phase with a clear message; never leave the repo in a broken state.
- After scaffolding (Phase 0), record the real run/test/lint/deploy commands in the section below so future sessions don't guess.
- If you go off the spec or discover the spec is wrong, stop and tell me — don't silently improvise.

### Project commands (recorded after Phase 0)
- Install: `npm install`  *(runs `postinstall` → `prisma generate`)*
- Dev server: `npm run dev`  *(http://localhost:3000)*
- Run tests: `npm test`  *(vitest; `npm run test:watch` to watch)*
- Typecheck: `npm run typecheck`  *(`tsc --noEmit`, strict)*
- Lint: `npm run lint`  *(`eslint`)*
- Production build: `npm run build`
- DB — apply migrations (incl. baseline `0_init`): `npm run db:deploy`
- DB — evolve schema later (dev): `npx prisma migrate dev --name <change>`
- DB — seed Org + Admin + §E pricing tables: `npm run db:seed`
- DB — Prisma Studio: `npm run db:studio`
- Deploy: push to GitHub → import in Vercel → set env vars (see `README.md` §3) → Vercel runs `postinstall` + `next build`. Run `db:deploy` + `db:seed` against Supabase separately.

### Stack notes for future sessions (verified Phase 0)
- **Next.js 16**: route protection is `src/proxy.ts` (NOT `middleware.ts`); `cookies()` is async.
- **Prisma 7**: no Rust engine. Connection URL is in `prisma.config.ts` (NOT `schema.prisma`, which holds `provider` only). Client uses a driver adapter (`@prisma/adapter-pg`) in `src/lib/db.ts`, generated into `src/generated/prisma` (gitignored).
- **Tailwind v4 + Zod v4** in use.
- Pricing-value source of truth: `src/lib/pricing/defaults.ts` (unit-tested against §E in `defaults.test.ts`).
- **Owner-confirmed rates (2026-06-20):** Fort Myers $70/hr and Luxury Naples $110/hr are locked in (Naples $85 was already pinned by the §5 fixture). All three market-tier rates are final.
- **Still provisional, Admin-editable (not yet confirmed):** FL tax rate (6% state base), deep-clean intensity premium (1.5), and the starter ZIP→tier map.
