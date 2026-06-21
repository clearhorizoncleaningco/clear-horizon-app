import { describe, expect, it } from "vitest";
import {
  buildActivityFeed,
  computeDashboardKpis,
  estimatesByFrequency,
  estimatesByTier,
  monthlyRevenueProjection,
  type EstimateRow,
  type JobRow,
} from "./aggregate";

const NOW = new Date(2026, 5, 21, 10, 0, 0); // Sun Jun 21 2026, local

function est(overrides: Partial<EstimateRow> = {}): EstimateRow {
  return {
    id: Math.random().toString(36).slice(2),
    createdAt: NOW,
    category: "Residential",
    status: "Saved",
    headlinePrice: 500,
    total: 500,
    isRecurring: true,
    projectedMonthly: 1085,
    frequencyLabel: "Biweekly",
    city: "Naples",
    tierLabel: "Naples",
    customerName: "Jane Doe",
    ...overrides,
  };
}

describe("computeDashboardKpis", () => {
  const rows: EstimateRow[] = [
    est({ id: "a", createdAt: NOW, status: "Approved", headlinePrice: 500, projectedMonthly: 1085 }),
    est({ id: "b", createdAt: new Date(2026, 5, 2), status: "Proposed", headlinePrice: 300, projectedMonthly: 651 }),
    est({ id: "c", createdAt: new Date(2026, 4, 15), status: "Saved", headlinePrice: 700, isRecurring: false, projectedMonthly: null, frequencyLabel: null, category: "Commercial" }),
    est({ id: "d", createdAt: NOW, status: "Declined", headlinePrice: 250, projectedMonthly: 542.5 }),
  ];

  it("counts estimates today and this month", () => {
    const k = computeDashboardKpis(rows, NOW);
    expect(k.estimatesToday).toBe(2); // a, d (both NOW)
    expect(k.estimatesThisMonth).toBe(3); // a, b, d in June; c is May
    expect(k.totalEstimates).toBe(4);
  });

  it("sums the projected monthly recurring book", () => {
    const k = computeDashboardKpis(rows, NOW);
    // recurring: a 1085 + b 651 + d 542.5 = 2278.5 (c is one-time)
    expect(k.projectedMonthlyRecurring).toBe(2278.5);
  });

  it("computes conversion = approved / proposed-or-beyond", () => {
    const k = computeDashboardKpis(rows, NOW);
    // proposed+ : a(Approved), b(Proposed), d(Declined) = 3; approved = 1
    expect(k.conversionApproved).toBe(1);
    expect(k.conversionProposed).toBe(3);
    expect(k.conversionRate).toBeCloseTo(1 / 3, 6);
  });

  it("computes average ticket across all estimates", () => {
    const k = computeDashboardKpis(rows, NOW);
    expect(k.avgTicket).toBe((500 + 300 + 700 + 250) / 4); // 437.5
  });
});

describe("charts", () => {
  it("groups estimates by frequency (commercial folds to its own bucket)", () => {
    const rows = [
      est({ frequencyLabel: "Biweekly" }),
      est({ frequencyLabel: "Biweekly" }),
      est({ frequencyLabel: "Weekly" }),
      est({ category: "Commercial", isRecurring: false, frequencyLabel: null }),
    ];
    const bars = estimatesByFrequency(rows);
    expect(bars[0]).toMatchObject({ label: "Biweekly", count: 2 });
    expect(bars.find((b) => b.label === "Commercial")?.count).toBe(1);
    expect(bars.find((b) => b.label === "Weekly")?.count).toBe(1);
  });

  it("groups estimates by tier (falls back to city)", () => {
    const rows = [
      est({ tierLabel: "Naples" }),
      est({ tierLabel: "Fort Myers" }),
      est({ tierLabel: null, city: "Bonita Springs" }),
    ];
    const bars = estimatesByTier(rows);
    expect(bars.map((b) => b.label).sort()).toEqual(["Bonita Springs", "Fort Myers", "Naples"]);
  });

  it("builds a last-6-months revenue projection ending at now", () => {
    const rows = [
      est({ createdAt: NOW, isRecurring: true, projectedMonthly: 1000 }),
      est({ createdAt: new Date(2026, 4, 10), isRecurring: false, projectedMonthly: null, headlinePrice: 700 }),
    ];
    const bars = monthlyRevenueProjection(rows, NOW, 6);
    expect(bars).toHaveLength(6);
    expect(bars[5].label).toBe("Jun 2026");
    expect(bars[5].value).toBe(1000); // recurring → projectedMonthly
    expect(bars[4].label).toBe("May 2026");
    expect(bars[4].value).toBe(700); // one-time → headline
    expect(bars[0].label).toBe("Jan 2026");
    expect(bars[0].value).toBe(0);
  });
});

describe("buildActivityFeed", () => {
  it("merges estimates + jobs, newest first, capped at limit", () => {
    const estimates: EstimateRow[] = [
      est({ id: "e1", createdAt: new Date(2026, 5, 20, 9) }),
    ];
    const jobs: JobRow[] = [
      { id: "j1", createdAt: new Date(2026, 5, 19), completedAt: new Date(2026, 5, 21, 8), status: "Completed", summary: "2,200 sq ft", customerName: "Acme" },
      { id: "j2", createdAt: new Date(2026, 5, 18), completedAt: null, status: "Scheduled", summary: null, customerName: "Bravo" },
    ];
    const feed = buildActivityFeed(estimates, jobs, 12);
    expect(feed).toHaveLength(3);
    expect(feed[0].id).toBe("job-done-j1"); // completed Jun 21 08:00 is newest
    expect(feed[0].kind).toBe("job");
    expect(feed[1].id).toBe("est-e1"); // Jun 20
    expect(feed[2].id).toBe("job-j2"); // Jun 18
  });

  it("respects the limit", () => {
    const estimates = Array.from({ length: 20 }, (_, i) => est({ id: `e${i}`, createdAt: new Date(2026, 5, i + 1) }));
    expect(buildActivityFeed(estimates, [], 5)).toHaveLength(5);
  });
});
