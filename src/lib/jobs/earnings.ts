/**
 * Cleaner earnings (BUILD_SPEC §G Phase 3 — "cleaner earnings view") — PURE.
 *
 * Rolls up what an assigned cleaner has earned across their COMPLETED jobs:
 * total pay, total hours, a by-month breakdown, and a recent list. Operates on
 * plain rows (no Prisma / React), so it is unit-testable without a database.
 *
 * This is the cleaner's OWN pay — not company margin (which stays Admin-only,
 * CLAUDE.md §3.5). `cleanerPayAmount` is set by Admin when logging the job.
 */
import { roundToCents } from "@/lib/pricing";

export interface EarningJobRow {
  id: string;
  completedAt: Date | string | null;
  status: string; // JobStatus
  summary: string | null;
  customerName: string | null;
  cleanerPayAmount: number | null;
  actualCrewHours: number | null;
}

export interface EarningMonth {
  key: string; // "2026-06"
  label: string; // "June 2026"
  jobs: number;
  earnings: number;
  hours: number;
}

export interface CleanerEarningsSummary {
  completedCount: number;
  paidCount: number; // completed with a pay amount set
  pendingCount: number; // completed but pay not yet entered
  totalEarnings: number;
  totalHours: number;
  avgPerJob: number; // over paid jobs
  byMonth: EarningMonth[]; // newest first
  recent: EarningJobRow[]; // newest completed first
}

function asDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d);
}

export function computeCleanerEarnings(
  jobs: EarningJobRow[],
  recentLimit = 10,
): CleanerEarningsSummary {
  const completed = jobs.filter((j) => j.status === "Completed");

  let totalEarnings = 0;
  let totalHours = 0;
  let paidCount = 0;
  const monthMap = new Map<string, EarningMonth>();

  for (const j of completed) {
    const pay = j.cleanerPayAmount ?? 0;
    const hours = j.actualCrewHours ?? 0;
    if (j.cleanerPayAmount != null) paidCount += 1;
    totalEarnings += pay;
    totalHours += hours;

    if (j.completedAt) {
      const d = asDate(j.completedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const bucket =
        monthMap.get(key) ??
        { key, label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }), jobs: 0, earnings: 0, hours: 0 };
      bucket.jobs += 1;
      bucket.earnings = roundToCents(bucket.earnings + pay);
      bucket.hours = Math.round((bucket.hours + hours) * 1000) / 1000;
      monthMap.set(key, bucket);
    }
  }

  const recent = [...completed]
    .sort((a, b) => {
      const at = a.completedAt ? asDate(a.completedAt).getTime() : 0;
      const bt = b.completedAt ? asDate(b.completedAt).getTime() : 0;
      return bt - at;
    })
    .slice(0, recentLimit);

  return {
    completedCount: completed.length,
    paidCount,
    pendingCount: completed.length - paidCount,
    totalEarnings: roundToCents(totalEarnings),
    totalHours: Math.round(totalHours * 1000) / 1000,
    avgPerJob: paidCount > 0 ? roundToCents(totalEarnings / paidCount) : 0,
    byMonth: [...monthMap.values()].sort((a, b) => (a.key < b.key ? 1 : -1)),
    recent,
  };
}
