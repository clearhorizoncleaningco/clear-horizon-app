import { describe, expect, it } from "vitest";
import { computeCleanerEarnings, type EarningJobRow } from "./earnings";

function job(overrides: Partial<EarningJobRow> = {}): EarningJobRow {
  return {
    id: Math.random().toString(36).slice(2),
    completedAt: new Date(2026, 5, 21),
    status: "Completed",
    summary: "2,200 sq ft · Naples",
    customerName: "Jane Doe",
    cleanerPayAmount: 120,
    actualCrewHours: 6,
    ...overrides,
  };
}

describe("computeCleanerEarnings", () => {
  it("totals pay and hours over completed jobs only", () => {
    const jobs = [
      job({ cleanerPayAmount: 120, actualCrewHours: 6, completedAt: new Date(2026, 5, 21) }),
      job({ cleanerPayAmount: 90, actualCrewHours: 4, completedAt: new Date(2026, 5, 14) }),
      job({ status: "Scheduled", cleanerPayAmount: 999, actualCrewHours: 9 }), // excluded
    ];
    const s = computeCleanerEarnings(jobs);
    expect(s.completedCount).toBe(2);
    expect(s.totalEarnings).toBe(210);
    expect(s.totalHours).toBe(10);
    expect(s.avgPerJob).toBe(105);
  });

  it("counts completed jobs awaiting a pay amount as pending", () => {
    const jobs = [
      job({ cleanerPayAmount: 120 }),
      job({ cleanerPayAmount: null }),
    ];
    const s = computeCleanerEarnings(jobs);
    expect(s.paidCount).toBe(1);
    expect(s.pendingCount).toBe(1);
    expect(s.avgPerJob).toBe(120); // average over PAID jobs
  });

  it("breaks earnings down by completion month, newest first", () => {
    const jobs = [
      job({ cleanerPayAmount: 120, completedAt: new Date(2026, 5, 21) }), // Jun
      job({ cleanerPayAmount: 80, completedAt: new Date(2026, 5, 7) }), // Jun
      job({ cleanerPayAmount: 100, completedAt: new Date(2026, 4, 12) }), // May
    ];
    const s = computeCleanerEarnings(jobs);
    expect(s.byMonth).toHaveLength(2);
    expect(s.byMonth[0]).toMatchObject({ key: "2026-06", jobs: 2, earnings: 200 });
    expect(s.byMonth[1]).toMatchObject({ key: "2026-05", jobs: 1, earnings: 100 });
  });

  it("orders the recent list by completion date desc and respects the limit", () => {
    const jobs = [
      job({ id: "old", completedAt: new Date(2026, 5, 1) }),
      job({ id: "new", completedAt: new Date(2026, 5, 28) }),
      job({ id: "mid", completedAt: new Date(2026, 5, 15) }),
    ];
    const s = computeCleanerEarnings(jobs, 2);
    expect(s.recent.map((j) => j.id)).toEqual(["new", "mid"]);
  });
});
