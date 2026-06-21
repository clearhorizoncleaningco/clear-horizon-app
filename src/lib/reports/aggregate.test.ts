import { describe, expect, it } from "vitest";
import type { EstimateRow } from "@/lib/dashboard/aggregate";
import {
  avgTicketReport,
  conversionReport,
  estimateCountsByPeriod,
  revenueProjectionReport,
  topCities,
} from "./aggregate";

function est(overrides: Partial<EstimateRow> = {}): EstimateRow {
  return {
    id: Math.random().toString(36).slice(2),
    createdAt: new Date(2026, 5, 21),
    category: "Residential",
    status: "Saved",
    headlinePrice: 500,
    total: 530,
    isRecurring: true,
    projectedMonthly: 1085,
    frequencyLabel: "Biweekly",
    city: "Naples",
    tierLabel: "Naples",
    customerName: "Jane Doe",
    ...overrides,
  };
}

describe("estimateCountsByPeriod", () => {
  const rows = [
    est({ createdAt: new Date(2026, 5, 21), headlinePrice: 500 }),
    est({ createdAt: new Date(2026, 5, 21), headlinePrice: 300 }),
    est({ createdAt: new Date(2026, 5, 14), headlinePrice: 700 }),
    est({ createdAt: new Date(2026, 4, 2), headlinePrice: 250 }),
  ];

  it("buckets by day, newest first", () => {
    const days = estimateCountsByPeriod(rows, "day");
    expect(days[0]).toMatchObject({ period: "2026-06-21", count: 2, totalValue: 800 });
    expect(days.at(-1)).toMatchObject({ period: "2026-05-02", count: 1, totalValue: 250 });
  });

  it("buckets by month", () => {
    const months = estimateCountsByPeriod(rows, "month");
    expect(months[0]).toMatchObject({ period: "2026-06", count: 3, totalValue: 1500 });
    expect(months[1]).toMatchObject({ period: "2026-05", count: 1 });
  });

  it("buckets by week (Sunday-anchored)", () => {
    // Jun 21 2026 is a Sunday → its own week start; Jun 14 is the prior Sunday.
    const weeks = estimateCountsByPeriod(rows, "week");
    expect(weeks[0].period).toBe("2026-06-21");
    expect(weeks[0].count).toBe(2);
  });
});

describe("conversionReport", () => {
  it("computes the funnel and conversion rate", () => {
    const rows = [
      est({ status: "Saved" }),
      est({ status: "Proposed" }),
      est({ status: "Approved" }),
      est({ status: "Approved" }),
      est({ status: "Declined" }),
    ];
    const r = conversionReport(rows);
    expect(r.total).toBe(5);
    expect(r.saved).toBe(1);
    expect(r.approved).toBe(2);
    expect(r.proposedPlus).toBe(4); // proposed + 2 approved + declined
    expect(r.conversionRate).toBeCloseTo(2 / 4, 6);
  });
});

describe("revenueProjectionReport", () => {
  it("lists recurring estimates by projected monthly, with totals", () => {
    const rows = [
      est({ projectedMonthly: 1085, isRecurring: true }),
      est({ projectedMonthly: 542.5, isRecurring: true }),
      est({ isRecurring: false, projectedMonthly: null }), // one-time excluded
    ];
    const r = revenueProjectionReport(rows);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0].projectedMonthly).toBe(1085); // sorted desc
    expect(r.totalMonthly).toBe(1627.5);
    expect(r.totalAnnual).toBe(19530);
  });
});

describe("topCities", () => {
  it("ranks cities by count then value", () => {
    const rows = [
      est({ city: "Naples" }),
      est({ city: "Naples" }),
      est({ city: "Fort Myers" }),
      est({ city: null, tierLabel: "Luxury Naples" }),
    ];
    const cities = topCities(rows, 10);
    expect(cities[0]).toMatchObject({ city: "Naples", count: 2 });
    expect(cities.find((c) => c.city === "Luxury Naples")?.count).toBe(1);
  });
});

describe("avgTicketReport", () => {
  it("computes averages overall and by category", () => {
    const rows = [
      est({ category: "Residential", headlinePrice: 500, total: 500 }),
      est({ category: "Residential", headlinePrice: 300, total: 300 }),
      est({ category: "Commercial", headlinePrice: 1000, total: 1060 }),
    ];
    const report = avgTicketReport(rows);
    const all = report.find((r) => r.segment === "All");
    const res = report.find((r) => r.segment === "Residential");
    const com = report.find((r) => r.segment === "Commercial");
    expect(all).toMatchObject({ count: 3, avgHeadline: 600 });
    expect(res).toMatchObject({ count: 2, avgHeadline: 400 });
    expect(com).toMatchObject({ count: 1, avgHeadline: 1000, avgTotal: 1060 });
  });
});
