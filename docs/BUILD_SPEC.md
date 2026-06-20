# BUILD PROMPT — Clear Horizon Cleaning Co. Estimating Platform (v1)

> **Read this whole section before coding.** This prompt is governed by an agreed implementation spec. The product has a deliberately narrow v1. **Do not over-build.** Build in phases, stop at each checkpoint, and wait for my review. Build **Phase 0 + Phase 1 first**, then stop.

---

## A. WHY THIS EXISTS (read before making any scope decision)

Two founders are launching a residential **and** commercial cleaning company in Southwest Florida (Naples, Fort Myers, Bonita Springs, Estero, Marco Island), nights-and-weekends, **pre-revenue**, with commercial leads arriving in ~2 weeks. They have operating experience but **no proprietary pricing data yet**, and **no time or money to waste rebuilding software they can rent.**

**The single success test for v1:**
> *In 60 days, the app reliably lets the founders do one thing they can't today: **accurately quote jobs** — and get measurably more accurate as real jobs are logged.*

Every feature is justified only if it serves that sentence. If something doesn't help **produce an accurate quote, turn it into a professional proposal, or hand that quote off**, it is deferred. When in doubt, **cut scope and ship the estimator.**

---

## B. BUILD vs. BORROW (the central architectural decision — do not violate)

- **BUILD (this app — the founders' IP):** the residential pricing engine; the guided estimate wizard; the per-visit + monthly + one-time initial-deep-clean quote output; internal margin/labor tracking; branded proposal PDFs; lightweight e-approval; a **manual commercial-quote path**; (later phases) light job tracking + customer photo reports, and a public quote widget.
- **BORROW (GoHighLevel — already paid for):** the contact/pipeline system of record, opportunity stages, appointment reminders, and marketing automation. **Do NOT build CRM, pipeline, marketing, or lead-gen features in this app.**
- **HANDOFF (one direction only):** the app **pushes** a finished quote to GoHighLevel — create/update the contact, attach the proposal, set the opportunity value. **GHL owns the pipeline; this app owns the quote.** No two-way sync. Build the push behind a feature flag with a configurable webhook URL, **stubbed off** until credentials are added.

### Explicit NON-GOALS for v1 (out of scope — do not build)
Accounting/invoicing/payroll · CRM/pipeline/marketing/lead-gen · scheduling calendar, field dispatch, route optimization · two-way GHL sync · franchise/multi-owner admin UI · an automated **commercial** pricing engine (commercial is a manual-price proposal path in v1).

---

## C. PRODUCT IDENTITY & BRAND

Internal estimating/quoting tool used by the **two owners** (laptop or phone, low volume at first), built to scale later to cleaners (job tracking + customer photo reports) and eventually a public quote widget. Optimize the estimator for **speed and low cognitive load**, including while on a call with a prospect.

- **Company:** Clear Horizon Cleaning Co. · Taglines: "Clean Spaces. Better Places." / "We bring the shine."
- **Contact:** admin@clearhorizoncleaners.com · www.clearhorizoncleaners.com · (239) 396-5740
- **Colors:** `#0D2B45` navy (headers/text) · `#1E6FB8` brand blue (primary actions) · `#7CC4F2` light blue (accents) · `#FDB813` sun gold (highlights, sparingly) · `#F1F3F6` light gray (backgrounds).
- **Type:** Montserrat Bold (headings), Montserrat Regular (body).
- **Logos:** I will place PNGs in `/public/brand/` (primary stacked, horizontal, circular badge, brandmark icon). Use horizontal logo in app header, brandmark as favicon, primary stacked logo on PDF proposals. Wire in by filename — do not generate placeholders.

---

## D. STACK (cheapest credible path; all free-tier to start)

Next.js (latest stable, App Router) + **TypeScript (strict)** · Tailwind + **shadcn/ui** · dark/light mode · responsive. **Supabase** = Postgres + Auth + Storage. **Prisma** ORM. **Vercel** hosting. Auth: email/password + magic link via Supabase Auth. Zod validation on every form and API boundary. Strong typing and error handling throughout. Server-side PDF generation (`@react-pdf/renderer` or Playwright-to-PDF — pick the lighter/more reliable and justify briefly).

### Architecture principles (cheap insurance for scale — required)
1. **Org-scoped from day one:** introduce an `Organization` entity; **every** business record carries `organizationId` and is always filtered by the current user's org. This makes a future franchise/second-owner additive, not a rewrite. **Build zero franchise admin UI in v1.**
2. **Pricing engine is an isolated, pure, fully unit-tested module** (e.g. `lib/pricing/`). **No pricing logic in React components or API handlers.** This is what makes the future public widget and any automation nearly free.
3. **No hardcoded pricing.** Every rate, multiplier, threshold, fee, and rule lives in the database, editable by Admin, **seeded from the calibrated defaults in §F** (these come from the Clear Horizon calibration workbook and supersede the original AI values).
4. **Roles:** `Admin` (the owners — full pricing + margin visibility), `Office Staff` (create quotes, no margin/pricing-edit access), and a **stubbed `Cleaner` role** (activated in Phase 3). Owners use Admin.

---

## E. THE PRICING ENGINE — TOP PRIORITY, BUILD CAREFULLY

> **The seeded numbers below are calibrated starting points, still NOT real job data.** Therefore every value is DB-stored and Admin-editable, and the engine ships as a **calibration instrument** (see Phase 3): it produces a confident, consistent quote *and* records what actually happened so accuracy compounds.

### E.1 Residential per-visit calculation
**Step 1 — Base labor hours** (editable table):

| Sq Ft | Hours |
|---|---|
| ≤ 1000 | 2.5 |
| 1001–1500 | 3.25 |
| 1501–2000 | 4.0 |
| 2001–2500 | 5.0 |
| 2501–3000 | 6.0 |
| 3001–4000 | 7.5 |
| 4001–5000 | 9.0 |
| > 5000 | `9.0 + ((sqft − 5000) / 500 × 1.25)` |

**Step 2 — Bathrooms:** `max(0, baths − 2) × 0.25`
**Step 3 — Bedrooms:** 1–3 → 0 · 4 → 0.25 · 5 → 0.50 · 6+ → 1.00
**Step 4 — Pets:** None 0 · 1 → 0.5 · 2+ → 1.0 · Heavy Shedding → 1.5
**Step 5 — Features (sum):** Stairs 0.50 · **Elevator 0.10** · Home Office 0.25 · Gym 0.25 · Theater 0.25 · Lanai 0.50 · Pool Bath 0.25
**Step 6 — Labor hours:** Base + Bathroom + Bedroom + Pet + Feature

**Step 7 — Occupancy ×:** Seasonal/Empty 0.90 · Couple 1.00 · Family 1.10 · Large Family 1.20 · Vacation Rental 1.15
**Step 8 — Flooring ×:** Tile 1.00 · Hardwood 1.05 · Carpet 1.10 · Luxury Mixed 1.15
**Step 9 — Condition ×:** Excellent 0.90 · Average 1.00 · Dirty 1.20 · Very Dirty 1.50

**Step 10 — Intensity reconciliation (do not double-count):** there is **no** separate first-time multiplier baked into the per-visit price. When the service is itself a **deep clean**, apply `max(conditionMultiplier, deepCleanPremium)` — never the product. Configurable rule (`intensityRule: "max" | "product"`, default `"max"`) and cap (default `1.75`).

**Step 11 — Production hours:** `LaborHours × Occupancy × Flooring × (reconciled intensity)`
**Step 12 — Hourly rate** (from tier, §E.3): editable.
**Step 13 — Frequency ×:** Weekly 0.90 · Biweekly 1.00 · Monthly 1.20 · One-Time Standard 1.35 · One-Time Deep Clean 1.75
**Step 14 — Seasonal ×:** May–Oct 1.00 · Nov–Apr 1.10 — auto-detect by date, manual override per quote.
**Step 15 — Base price:** `ProductionHours × Rate × Frequency × Seasonal`
**Step 16 — Travel fee** (editable; origin may be blank — see §E.4): 0–10 mi $0 · 10–20 mi $25 · 20–30 mi $50 · 30+ mi → flag "manual review."
**Step 17 — Add-ons** (editable, quantity-aware): Oven $50 · Refrigerator $50 · Interior Windows $8/ea · Baseboards $75 · Ceiling Fans $5/ea · Inside Cabinets $100 · Laundry $50 · Linens $25
**Step 18 — Subtotal:** Base + Travel + Add-ons
**Step 19 — Minimum charge** (by tier): Fort Myers $175 · Naples $225 · Luxury Naples $300 → `max(Subtotal, Minimum)`
**Step 20 — Tax** (see §E.5): per-jurisdiction, with a per-service-type taxable flag (residential generally non-taxable in FL; commercial taxable).
**Step 21 — Round the pre-tax price UP to the next $25** (`CEILING`, always up), then add tax. Document and keep consistent.

### E.2 Recurring quotes output TWO numbers (resolves deep-clean overlap)
For any recurring service, the results screen and proposal show **both**: (1) a separate one-time **Initial Deep Clean** line (same property priced with the deep premium, charged once for the first visit), and (2) the **recurring per-visit price**, plus (3) **projected monthly value** = per-visit × visits/month (Weekly 4.33 · Biweekly 2.17 · Monthly 1; editable). One-time quotes show a single price. A recurring frequency and a one-time deep premium are never multiplied on the same line.

### E.3 Market tier resolution
Admin-editable **ZIP → tier** table (Fort Myers / Naples / Luxury Naples) drives hourly rate + minimum. Manual tier **override** on every quote. Configurable default tier when a ZIP is unmapped, with a subtle hint. Tiers are data — new tiers add without code.

### E.4 Travel/distance (no physical office yet)
Origin address is a Settings field that **may be blank**. While blank: skip auto-distance, default travel $0, let the rep pick a bracket or enter miles manually. Architect so that adding an origin + Google Maps key later enables autocomplete + auto-distance. Ship the manual path first.

### E.5 Tax
Admin-editable tax-rate table keyed by jurisdiction; each service type has a `taxable` flag (default residential = false, commercial = true; Admin can override). Tax shown as its own line.

### E.6 Internal margin (Admin-only — never shown to staff/clients)
Admin sets a **blended labor cost per actual crew-hour** (seed **$22**) and **supplies per visit** (seed **$10**). Target labor = **50%** of price (band **40–60%**). Per quote, compute and show **to Admin only**: estimated labor cost, supplies, projected margin, and a flag when labor % falls outside the band.

### E.7 Property type
Capture as a record field carrying an **editable multiplier defaulted to 1.0** (no effect today, ready later). No other pricing effect.

### E.8 Manual commercial-quote path (v1 commercial = manual)
Commercial has **no automated engine in v1.** Provide a path where the owner enters a price they reached from a walk-through (plus frequency, scope notes, optional line items) and the app produces the same branded proposal + handoff. Clearly separate from the residential engine. (A real commercial engine is Phase 4, after real commercial jobs exist.)

### E.9 Unit tests (REQUIRED in Phase 1)
Comprehensive unit tests on the pricing module: each step, the `max()` intensity rule, the two-number recurring output, round-up behavior, minimum flooring, tier resolution, and several end-to-end fixtures (e.g. **2,200 sq ft / 3 bed / 2.5 bath / biweekly / Naples / average / 1 pet → assert base 5.0 hrs, production 5.625 hrs, base price $478.13, model price $500**). Must pass before the Phase 1 checkpoint.

---

## F. ESTIMATOR WIZARD (optimize for live calls)
Guided, keyboard-friendly, fast, with a **live running price** that updates as steps complete. Steps: (1) Customer info — name/email/phone/address/city/ZIP/notes + **duplicate detection**; (2) Property — sqft, beds, baths, ZIP→tier (+override), property type; (3) Conditions — occupancy, floor, condition, pets; (4) Features — checkbox cards; (5) Service type — recurring (Weekly/Biweekly/Monthly) or one-time (Standard/Deep), seasonal auto+override; (6) Add-ons — quantity selectors; (7) Results — visual summary: labor hrs, production hrs, full breakdown, add-ons, travel, tax, **per-visit + projected monthly + separate one-time initial-deep-clean line**, final rounded price, Admin-only margin panel. Actions: Save · Generate Proposal · (Phase 2) Push to GHL · (later) Convert to Job. A separate **Commercial Quote** entry point uses the manual path (§E.8).

---

## G. PHASED PLAN — follow this order, checkpoint between phases, stop after Phase 1

**PHASE 0 — Foundation.** Scaffold Next.js+TS+Tailwind+shadcn; Supabase project; Prisma schema with **org-scoped** models; Supabase Auth with Admin/Office roles + stubbed Cleaner; seed an Organization, an Admin user, and all pricing tables from §E defaults; deploy a working skeleton to Vercel.
*Checkpoint:* I can log in, see an empty themed dashboard, deploy works. Provide `.env.example`, setup steps, one-command run.

**PHASE 1 — The estimator (this IS the v1 success test).** Full residential engine (§E) with **unit tests**; the wizard (§F) with live price; results screen incl. per-visit + monthly + one-time deep line + Admin margin panel; basic Admin settings to edit any pricing value; the **manual commercial-quote path** (§E.8).
*Checkpoint:* I quote a real residential job end-to-end and verify the math by hand against the fixtures; I produce a manual commercial quote. **This is the minimum operational product — STOP HERE and wait.**

**PHASE 2 — Save & propose + GHL handoff.** Customer records, profiles, search, duplicate detection; save/retrieve estimates; **branded PDF proposals** with residential + commercial T&C templates (generated from my sample but **two-party Clear Horizon only — remove all Jan-Pro/Service-Coordinator franchise language and the California CPSWPA fee; keep FL choice-of-law/Naples venue, net terms, late fee, 3% annual increase, holidays, non-solicitation, insurance, liability cap**); structured scope-of-work checklists per service type; lightweight e-approval (checkbox "I agree" + typed name + timestamp + IP); 30-day expiration; **one-way GHL push behind a feature flag** (create/update contact, attach proposal, set opportunity value) — stubbed off until credentials added; email delivery stubbed off.
*Checkpoint:* save a customer, generate a branded PDF, approve via link, see the (stubbed) GHL payload.

**PHASE 3 — Light operations & the data loop.** Dashboard KPIs (Estimates Today/Month, Est. Revenue, Conversion, Avg Ticket) + charts (Monthly Revenue Projection, Estimates by Frequency, Estimates by City/Tier) + activity feed; reports (Estimate daily/weekly/monthly, Revenue Projection, Conversion, Top Cities, Avg Ticket) with **CSV/Excel export**; **the calibration loop in-app** — log actual crew hours, actual labor $, and price charged per job, surfacing margin vs. the 50% target (mirror the calibration workbook); activate the **minimal Cleaner view** (see assigned job, mark progress/done, upload before/after photos → customer report) + cleaner earnings view; audit logs on pricing changes.
*Checkpoint:* dashboard reflects real data; a cleaner completes a job and a customer photo report is generated.

**PHASE 4 — Earned expansion (only after revenue + real data).** Public customer-facing quote widget (same engine, public simplified form); turn GHL push live; turn email on; **Stripe Checkout** deposits (hosted page — we never touch card data); a true **commercial pricing engine** calibrated to closed commercial jobs; Google Maps autocomplete + auto-distance travel (once origin set). Evaluate scheduling/dispatch **build-vs-rent here, not before.**

---

## H. DELIVERABLES & STANDARDS
Architecture doc · Prisma schema · API routes · pages/components · auth · the pricing service · PDF generator · seed data (from §E) · `.env.example` · copy-paste install instructions · **Vercel + Supabase deploy instructions**. Production-quality (not a prototype), strict TypeScript, Zod validation, robust error handling, **comprehensive unit tests on the pricing engine** + lighter integration tests on APIs (**skip full E2E for now**), inline docs. I am **deploying this myself** with limited time — every step must be explicit and copy-paste-able.

**Remember: build Phase 0 + Phase 1, then stop and wait for my verification.**
