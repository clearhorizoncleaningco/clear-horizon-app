/**
 * Report aggregations (BUILD_SPEC §G Phase 3) — a PURE module.
 *
 * Builds the report tables — estimates by day/week/month, revenue projection,
 * conversion, top cities, average ticket — from plain `EstimateRow`s (reused
 * from the dashboard module). No Prisma / `server-only` / React: unit-testable
 * without a database (CLAUDE.md §3.2). The route handler turns these into CSV
 * via reports/csv.ts; the page renders them as tables.
 *
 * Customer-safe figures only (headline prices) — no margin/cost (CLAUDE.md §3.5).
 */
import { roundToCents } from "@/lib/pricing";
import type { EstimateRow } from "@/lib/dashboard/aggregate";

export type Period = "day" | "week" | "month";

export interface PeriodCountRow {
  period: string; // sortable key (e.g. "2026-06-21")
  label: string; // human label
  count: number;
  totalValue: number; // Σ headlinePrice
}

export interface ConversionReport {
  total: number;
  saved: number;
  proposed: number; // status === "Proposed" (awaiting customer action)
  approved: number;
  declined: number;
  expired: number;
  proposedPlus: number; // reached a proposal (proposed/approved/declined/expired)
  conversionRate: number; // approved / proposedPlus
}

export interface RevenueProjectionRow {
  estimateId: string;
  customer: string;
  frequency: string;
  perVisit: number;
  projectedMonthly: number;
}
export interface RevenueProjectionReport {
  rows: RevenueProjectionRow[];
  totalMonthly: number;
  totalAnnual: number;
}

export interface CityRow {
  city: string;
  count: number;
  totalValue: number;
}

export interface AvgTicketRow {
  segment: string;
  count: number;
  avgHeadline: number;
  avgTotal: number;
}

function asDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Sunday-anchored start of the week for the given date. */
function weekStart(d: Date): Date {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  s.setDate(s.getDate() - s.getDay());
  return s;
}

function periodKeyLabel(d: Date, period: Period): { key: string; label: string } {
  if (period === "day") {
    return {
      key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    };
  }
  if (period === "week") {
    const ws = weekStart(d);
    return {
      key: `${ws.getFullYear()}-${pad(ws.getMonth() + 1)}-${pad(ws.getDate())}`,
      label: `Week of ${ws.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
    };
  }
  return {
    key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`,
    label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
  };
}

/** Estimate counts + value bucketed by day / week / month, newest period first. */
export function estimateCountsByPeriod(rows: EstimateRow[], period: Period): PeriodCountRow[] {
  const map = new Map<string, PeriodCountRow>();
  for (const e of rows) {
    const { key, label } = periodKeyLabel(asDate(e.createdAt), period);
    const bucket = map.get(key) ?? { period: key, label, count: 0, totalValue: 0 };
    bucket.count += 1;
    bucket.totalValue = roundToCents(bucket.totalValue + e.headlinePrice);
    map.set(key, bucket);
  }
  return [...map.values()].sort((a, b) => (a.period < b.period ? 1 : a.period > b.period ? -1 : 0));
}

export function conversionReport(rows: EstimateRow[]): ConversionReport {
  const count = (s: string) => rows.filter((e) => e.status === s).length;
  const saved = count("Saved");
  const proposed = count("Proposed");
  const approved = count("Approved");
  const declined = count("Declined");
  const expired = count("Expired");
  const proposedPlus = proposed + approved + declined + expired;
  return {
    total: rows.length,
    saved,
    proposed,
    approved,
    declined,
    expired,
    proposedPlus,
    conversionRate: proposedPlus > 0 ? approved / proposedPlus : 0,
  };
}

export function revenueProjectionReport(rows: EstimateRow[]): RevenueProjectionReport {
  const recurring = rows.filter((e) => e.isRecurring && e.projectedMonthly != null);
  const projRows: RevenueProjectionRow[] = recurring.map((e) => ({
    estimateId: e.id,
    customer: e.customerName ?? "—",
    frequency: e.frequencyLabel ?? "Recurring",
    perVisit: e.headlinePrice,
    projectedMonthly: e.projectedMonthly as number,
  }));
  const totalMonthly = roundToCents(projRows.reduce((s, r) => s + r.projectedMonthly, 0));
  return {
    rows: projRows.sort((a, b) => b.projectedMonthly - a.projectedMonthly),
    totalMonthly,
    totalAnnual: roundToCents(totalMonthly * 12),
  };
}

export function topCities(rows: EstimateRow[], limit = 10): CityRow[] {
  const map = new Map<string, CityRow>();
  for (const e of rows) {
    const city = e.city?.trim() || e.tierLabel?.trim() || "Unspecified";
    const bucket = map.get(city) ?? { city, count: 0, totalValue: 0 };
    bucket.count += 1;
    bucket.totalValue = roundToCents(bucket.totalValue + e.headlinePrice);
    map.set(city, bucket);
  }
  return [...map.values()]
    .sort((a, b) => b.count - a.count || b.totalValue - a.totalValue)
    .slice(0, limit);
}

export function avgTicketReport(rows: EstimateRow[]): AvgTicketRow[] {
  const segment = (label: string, subset: EstimateRow[]): AvgTicketRow => ({
    segment: label,
    count: subset.length,
    avgHeadline: subset.length ? roundToCents(subset.reduce((s, e) => s + e.headlinePrice, 0) / subset.length) : 0,
    avgTotal: subset.length ? roundToCents(subset.reduce((s, e) => s + e.total, 0) / subset.length) : 0,
  });
  return [
    segment("All", rows),
    segment("Residential", rows.filter((e) => e.category === "Residential")),
    segment("Commercial", rows.filter((e) => e.category === "Commercial")),
  ];
}
