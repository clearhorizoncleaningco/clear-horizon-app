/**
 * Dashboard aggregation (BUILD_SPEC §G Phase 3) — a PURE module.
 *
 * Computes the dashboard KPIs, the three charts (Monthly Revenue Projection,
 * Estimates by Frequency, Estimates by City/Tier) and the activity feed from
 * plain row arrays. No Prisma / `server-only` / React, so it is unit-testable
 * without a database (CLAUDE.md §3.2). The service maps Prisma rows → these
 * shapes and calls in; pages render the result.
 *
 * NOTE: nothing here is margin/cost/labor — the dashboard is visible to Office
 * Staff, so it carries only customer-safe headline figures (CLAUDE.md §3.5).
 */
import { roundToCents } from "@/lib/pricing";

export interface EstimateRow {
  id: string;
  createdAt: Date | string;
  category: "Residential" | "Commercial";
  status: string; // EstimateStatus
  headlinePrice: number; // per-visit (recurring) or one-time pre-tax
  total: number;
  isRecurring: boolean;
  projectedMonthly: number | null;
  frequencyLabel: string | null;
  city: string | null;
  tierLabel: string | null; // market-tier label (resultJson.marketTier.label)
  customerName: string | null;
}

export interface JobRow {
  id: string;
  createdAt: Date | string;
  completedAt: Date | string | null;
  status: string; // JobStatus
  summary: string | null;
  customerName: string | null;
}

export interface DashboardKpis {
  estimatesToday: number;
  estimatesThisMonth: number;
  /** Projected monthly recurring book: Σ projectedMonthly over recurring estimates. */
  projectedMonthlyRecurring: number;
  /** Value of estimates created this month (per-visit recurring + one-time). */
  estValueThisMonth: number;
  conversionApproved: number;
  conversionProposed: number; // estimates that reached "proposed or beyond"
  conversionRate: number; // approved / proposed (0..1)
  avgTicket: number; // mean headlinePrice across all estimates
  totalEstimates: number;
}

export interface ChartBar {
  label: string;
  value: number; // dollars
  count: number;
}

export interface ActivityItem {
  id: string;
  kind: "estimate" | "job";
  at: string; // ISO
  title: string;
  detail: string;
  href: string;
  amount: number | null;
}

// ----------------------------------------------------------------------------
// Date helpers (local-time; callers pass an explicit `now` for determinism)
// ----------------------------------------------------------------------------

function asDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d);
}
function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function sameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}
function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/** The estimated revenue an estimate contributes: recurring → monthly, else one-time. */
function revenueContribution(e: EstimateRow): number {
  return e.isRecurring ? (e.projectedMonthly ?? 0) : e.headlinePrice;
}

const PROPOSED_PLUS = new Set(["Proposed", "Approved", "Declined", "Expired"]);

// ----------------------------------------------------------------------------
// KPIs
// ----------------------------------------------------------------------------

export function computeDashboardKpis(rows: EstimateRow[], now: Date): DashboardKpis {
  let estimatesToday = 0;
  let estimatesThisMonth = 0;
  let estValueThisMonth = 0;
  let projectedMonthlyRecurring = 0;
  let conversionApproved = 0;
  let conversionProposed = 0;
  let headlineSum = 0;

  for (const e of rows) {
    const created = asDate(e.createdAt);
    if (sameDay(created, now)) estimatesToday += 1;
    if (sameMonth(created, now)) {
      estimatesThisMonth += 1;
      estValueThisMonth += revenueContribution(e);
    }
    if (e.isRecurring) projectedMonthlyRecurring += e.projectedMonthly ?? 0;
    if (e.status === "Approved") conversionApproved += 1;
    if (PROPOSED_PLUS.has(e.status)) conversionProposed += 1;
    headlineSum += e.headlinePrice;
  }

  return {
    estimatesToday,
    estimatesThisMonth,
    projectedMonthlyRecurring: roundToCents(projectedMonthlyRecurring),
    estValueThisMonth: roundToCents(estValueThisMonth),
    conversionApproved,
    conversionProposed,
    conversionRate: conversionProposed > 0 ? conversionApproved / conversionProposed : 0,
    avgTicket: rows.length > 0 ? roundToCents(headlineSum / rows.length) : 0,
    totalEstimates: rows.length,
  };
}

// ----------------------------------------------------------------------------
// Charts
// ----------------------------------------------------------------------------

function groupBars(
  rows: EstimateRow[],
  keyOf: (e: EstimateRow) => string,
): ChartBar[] {
  const map = new Map<string, { value: number; count: number }>();
  for (const e of rows) {
    const key = keyOf(e);
    const bucket = map.get(key) ?? { value: 0, count: 0 };
    bucket.value += revenueContribution(e);
    bucket.count += 1;
    map.set(key, bucket);
  }
  return [...map.entries()]
    .map(([label, b]) => ({ label, value: roundToCents(b.value), count: b.count }))
    .sort((a, b) => b.count - a.count || b.value - a.value);
}

/** Estimates by Frequency (§G). Commercial / one-time fold into clear buckets. */
export function estimatesByFrequency(rows: EstimateRow[]): ChartBar[] {
  return groupBars(rows, (e) =>
    e.category === "Commercial"
      ? "Commercial"
      : e.frequencyLabel?.trim() || "One-time",
  );
}

/** Estimates by City/Tier (§G) — keyed by market tier, falling back to city. */
export function estimatesByTier(rows: EstimateRow[]): ChartBar[] {
  return groupBars(rows, (e) => e.tierLabel?.trim() || e.city?.trim() || "Unspecified");
}

/** Monthly Revenue Projection (§G) — estimated revenue by creation month, last N months. */
export function monthlyRevenueProjection(
  rows: EstimateRow[],
  now: Date,
  months = 6,
): ChartBar[] {
  // Build the ordered list of month buckets ending at `now`.
  const buckets: { key: string; label: string; value: number; count: number }[] = [];
  const index = new Map<string, number>();
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(d);
    index.set(key, buckets.length);
    buckets.push({ key, label: monthLabel(d), value: 0, count: 0 });
  }
  for (const e of rows) {
    const key = monthKey(asDate(e.createdAt));
    const at = index.get(key);
    if (at === undefined) continue;
    buckets[at].value += revenueContribution(e);
    buckets[at].count += 1;
  }
  return buckets.map((b) => ({ label: b.label, value: roundToCents(b.value), count: b.count }));
}

// ----------------------------------------------------------------------------
// Activity feed
// ----------------------------------------------------------------------------

export function buildActivityFeed(
  estimates: EstimateRow[],
  jobs: JobRow[],
  limit = 12,
): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const e of estimates) {
    items.push({
      id: `est-${e.id}`,
      kind: "estimate",
      at: asDate(e.createdAt).toISOString(),
      title: e.customerName ?? "New estimate",
      detail: `${e.category} estimate saved${e.frequencyLabel ? ` · ${e.frequencyLabel}` : ""}`,
      href: `/estimates/${e.id}`,
      amount: e.headlinePrice,
    });
  }

  for (const j of jobs) {
    const completed = j.completedAt ? asDate(j.completedAt) : null;
    if (completed && j.status === "Completed") {
      items.push({
        id: `job-done-${j.id}`,
        kind: "job",
        at: completed.toISOString(),
        title: j.customerName ?? "Job completed",
        detail: `Job completed${j.summary ? ` · ${j.summary}` : ""}`,
        href: `/jobs/${j.id}`,
        amount: null,
      });
    } else {
      items.push({
        id: `job-${j.id}`,
        kind: "job",
        at: asDate(j.createdAt).toISOString(),
        title: j.customerName ?? "Job created",
        detail: `Job ${j.status.toLowerCase()}${j.summary ? ` · ${j.summary}` : ""}`,
        href: `/jobs/${j.id}`,
        amount: null,
      });
    }
  }

  return items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).slice(0, limit);
}
