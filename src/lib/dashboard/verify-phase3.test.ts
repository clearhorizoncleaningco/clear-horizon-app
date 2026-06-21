import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildConfigFromDefaults, computeResidentialQuote, type ResidentialQuoteInput } from "@/lib/pricing";
import {
  buildActivityFeed,
  computeDashboardKpis,
  estimatesByFrequency,
  estimatesByTier,
  monthlyRevenueProjection,
  type EstimateRow,
  type JobRow,
} from "./aggregate";
import {
  conversionReport,
  estimateCountsByPeriod,
  revenueProjectionReport,
  topCities,
  avgTicketReport,
} from "@/lib/reports/aggregate";
import { toCsv } from "@/lib/reports/csv";
import { computeJobCalibration, summarizeCalibration, type MarginParams } from "@/lib/calibration/compute";
import { computeCleanerEarnings, type EarningJobRow } from "@/lib/jobs/earnings";
import { currency0, percent } from "@/lib/format";

/**
 * Phase 3 §G checkpoint — "dashboard reflects real data." A DB-free mirror of the
 * sample seed: builds representative estimates + jobs, runs the dashboard /
 * reports / calibration / earnings aggregations, prints the computed numbers, and
 * writes tmp/sample-dashboard.html + tmp/report-*.csv so the output can be
 * inspected. Run on its own with `npm run verify:phase3`.
 */

const NOW = new Date(2026, 5, 21, 12, 0, 0); // Jun 21 2026, local
const TMP = path.join(process.cwd(), "tmp");
const MARGIN: MarginParams = { laborCostPerHour: 22, suppliesPerVisit: 10, targetLaborPct: 0.5, laborBandMin: 0.4, laborBandMax: 0.6 };

function daysBefore(n: number): Date {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n);
  return d;
}

const config = buildConfigFromDefaults();
function price(over: Partial<ResidentialQuoteInput>) {
  const input: ResidentialQuoteInput = {
    sqft: 2200, bedrooms: 3, bathrooms: 2.5, occupancyKey: "Couple", flooringKey: "Tile",
    conditionKey: "Average", petKey: "One", featureKeys: [], frequencyKey: "Biweekly", addOns: [],
    seasonalOverride: null, quoteDate: NOW, ...over,
  };
  return computeResidentialQuote(input, config);
}

interface Sample {
  est: EstimateRow;
  job?: { status: string; completedAt: Date | null; priceCharged: number | null; actualCrewHours: number | null; cleanerPay: number | null; estProdHours: number; estLaborCost: number };
}

function build(): Sample[] {
  const naplesBi = price({ marketTierKeyOverride: "Naples", frequencyKey: "Biweekly", featureKeys: ["Lanai"] });
  const luxWeekly = price({ marketTierKeyOverride: "LuxuryNaples", frequencyKey: "Weekly", sqft: 3200, bedrooms: 4, bathrooms: 3.5, occupancyKey: "Family", flooringKey: "LuxuryMixed" });
  const fmMonthly = price({ marketTierKeyOverride: "FortMyers", frequencyKey: "Monthly", sqft: 1800, conditionKey: "Dirty" });
  const deep = price({ marketTierKeyOverride: "Naples", frequencyKey: "OneTimeDeep", sqft: 2600, bedrooms: 4, bathrooms: 3, conditionKey: "VeryDirty" });
  const bonitaBi = price({ marketTierKeyOverride: "Naples", frequencyKey: "Biweekly", sqft: 2000, bathrooms: 2 });
  const fmWeekly = price({ marketTierKeyOverride: "FortMyers", frequencyKey: "Weekly", sqft: 1500, bedrooms: 2, bathrooms: 2 });

  const row = (id: string, r: ReturnType<typeof price>, over: Partial<EstimateRow>): EstimateRow => ({
    id, createdAt: NOW, category: "Residential", status: "Saved",
    headlinePrice: r.primary.preTaxPrice, total: r.primary.total, isRecurring: r.isRecurring,
    projectedMonthly: r.projectedMonthly, frequencyLabel: r.primary.frequencyLabel,
    city: null, tierLabel: r.marketTier.label, customerName: null, ...over,
  });
  const econ = (r: ReturnType<typeof price>) => ({ estProdHours: r.primary.productionHours, estLaborCost: r.primary.margin.estimatedLaborCost });

  return [
    { est: row("e1", naplesBi, { status: "Approved", createdAt: daysBefore(6), city: "Naples", customerName: "Jane Doe" }),
      job: { status: "Completed", completedAt: daysBefore(2), priceCharged: 500, actualCrewHours: 6, cleanerPay: 132, ...econ(naplesBi) } },
    { est: row("e2", luxWeekly, { status: "Approved", createdAt: daysBefore(20), city: "Naples", customerName: "Robert Smith" }),
      job: { status: "Completed", completedAt: daysBefore(5), priceCharged: 825, actualCrewHours: 14, cleanerPay: 308, ...econ(luxWeekly) } },
    { est: row("e3", fmMonthly, { status: "Proposed", createdAt: daysBefore(3), city: "Fort Myers", customerName: "Maria Garcia" }),
      job: { status: "InProgress", completedAt: null, priceCharged: null, actualCrewHours: null, cleanerPay: null, ...econ(fmMonthly) } },
    { est: row("e4", deep, { status: "Approved", createdAt: daysBefore(40), city: "Marco Island", customerName: "David Brown" }),
      job: { status: "Completed", completedAt: daysBefore(33), priceCharged: 700, actualCrewHours: 12, cleanerPay: 264, ...econ(deep) } },
    { est: row("e5", bonitaBi, { status: "Declined", createdAt: daysBefore(50), city: "Bonita Springs", customerName: "Linda Wilson" }) },
    { est: row("e6", fmWeekly, { status: "Saved", createdAt: NOW, city: "Estero", customerName: "Tom Anderson" }),
      job: { status: "Scheduled", completedAt: null, priceCharged: null, actualCrewHours: null, cleanerPay: null, ...econ(fmWeekly) } },
  ];
}

function barRows(bars: { label: string; value: number; count: number }[], metric: "count" | "value"): string {
  const max = Math.max(1, ...bars.map((b) => (metric === "value" ? b.value : b.count)));
  return bars
    .map((b) => {
      const mag = metric === "value" ? b.value : b.count;
      const pct = Math.max(3, Math.round((mag / max) * 100));
      return `<div style="display:flex;align-items:center;gap:10px;margin:4px 0"><span style="width:120px;font-size:13px">${b.label}</span><span style="flex:1;background:#e7edf3;border-radius:4px;overflow:hidden"><span style="display:block;height:18px;width:${pct}%;background:#1e6fb8"></span></span><span style="width:120px;text-align:right;font-size:13px;color:#5b6b7b">${b.count} · ${currency0(b.value)}</span></div>`;
    })
    .join("");
}

describe("Phase 3 dashboard reflects sample jobs (verify:phase3)", () => {
  it("computes KPIs/charts/reports/calibration and writes artifacts", () => {
    const samples = build();
    const estRows = samples.map((s) => s.est);
    const jobRows: JobRow[] = samples
      .filter((s) => s.job)
      .map((s, i) => ({ id: `j${i}`, createdAt: s.est.createdAt, completedAt: s.job!.completedAt, status: s.job!.status, summary: s.est.tierLabel, customerName: s.est.customerName }));

    // ---- Dashboard ----
    const kpis = computeDashboardKpis(estRows, NOW);
    const byFreq = estimatesByFrequency(estRows);
    const byTier = estimatesByTier(estRows);
    const revProj = monthlyRevenueProjection(estRows, NOW, 6);
    const activity = buildActivityFeed(estRows, jobRows, 12);

    expect(kpis.totalEstimates).toBe(6);
    expect(kpis.projectedMonthlyRecurring).toBeGreaterThan(0);
    expect(kpis.conversionApproved).toBe(3);
    expect(byFreq.length).toBeGreaterThan(0);
    expect(revProj).toHaveLength(6);
    expect(activity.length).toBeGreaterThan(0);

    // ---- Reports ----
    const byMonth = estimateCountsByPeriod(estRows, "month");
    const conv = conversionReport(estRows);
    const rev = revenueProjectionReport(estRows);
    const cities = topCities(estRows, 15);
    const tickets = avgTicketReport(estRows);
    expect(conv.approved).toBe(3);
    expect(rev.totalMonthly).toBeGreaterThan(0);

    // ---- Calibration ----
    const cals = samples
      .filter((s) => s.job)
      .map((s) =>
        computeJobCalibration(
          { quotedPrice: s.est.headlinePrice, estProductionHours: s.job!.estProdHours, estLaborCost: s.job!.estLaborCost, priceCharged: s.job!.priceCharged, actualCrewHours: s.job!.actualCrewHours, actualLaborCost: null, actualSuppliesCost: null },
          MARGIN,
        ),
      );
    const calSummary = summarizeCalibration(cals, MARGIN);
    expect(calSummary.jobsWithActuals).toBe(3);

    // ---- Earnings (cleaner) ----
    const earningRows: EarningJobRow[] = samples
      .filter((s) => s.job)
      .map((s, i) => ({ id: `j${i}`, completedAt: s.job!.completedAt, status: s.job!.status, summary: s.est.tierLabel, customerName: s.est.customerName, cleanerPayAmount: s.job!.cleanerPay, actualCrewHours: s.job!.actualCrewHours }));
    const earnings = computeCleanerEarnings(earningRows);
    expect(earnings.completedCount).toBe(3);
    expect(earnings.totalEarnings).toBe(132 + 308 + 264);

    // ---- Write CSVs ----
    mkdirSync(TMP, { recursive: true });
    const csvFiles: Record<string, string> = {
      "report-estimates-monthly.csv": toCsv(["Month", "Estimates", "Headline value"], byMonth.map((r) => [r.label, r.count, r.totalValue])),
      "report-conversion.csv": toCsv(["Metric", "Value"], [["Total", conv.total], ["Approved", conv.approved], ["Conversion", `${(conv.conversionRate * 100).toFixed(1)}%`]]),
      "report-revenue-projection.csv": toCsv(["Customer", "Frequency", "Per visit", "Projected monthly"], rev.rows.map((r) => [r.customer, r.frequency, r.perVisit, r.projectedMonthly])),
      "report-top-cities.csv": toCsv(["City", "Estimates", "Value"], cities.map((c) => [c.city, c.count, c.totalValue])),
      "report-avg-ticket.csv": toCsv(["Segment", "Count", "Avg headline", "Avg total"], tickets.map((t) => [t.segment, t.count, t.avgHeadline, t.avgTotal])),
    };
    for (const [name, csv] of Object.entries(csvFiles)) writeFileSync(path.join(TMP, name), csv, "utf8");

    // ---- Write dashboard HTML artifact ----
    const kpiCard = (label: string, value: string, hint: string) =>
      `<div style="border:1px solid #e7edf3;border-radius:12px;padding:16px;flex:1 1 180px"><div style="font-size:12px;color:#5b6b7b;text-transform:uppercase;letter-spacing:.5px">${label}</div><div style="font-size:28px;font-weight:800;color:#0d2b45">${value}</div><div style="font-size:12px;color:#8794a3">${hint}</div></div>`;
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Clear Horizon — Dashboard (sample)</title></head><body style="margin:0;background:#eef2f6;font-family:Montserrat,system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0d2b45"><div style="max-width:980px;margin:0 auto;padding:24px"><h1 style="font-size:24px">Dashboard — sample data</h1><p style="color:#5b6b7b">DB-free preview generated by verify:phase3 · ${samples.length} estimates · ${jobRows.length} jobs</p><div style="display:flex;flex-wrap:wrap;gap:12px;margin:16px 0">${kpiCard("Estimates today", String(kpis.estimatesToday), `${kpis.estimatesThisMonth} this month`)}${kpiCard("Projected monthly recurring", currency0(kpis.projectedMonthlyRecurring), "booked recurring quotes")}${kpiCard("Conversion", percent(kpis.conversionRate, 0), `${kpis.conversionApproved} of ${kpis.conversionProposed}`)}${kpiCard("Avg ticket", currency0(kpis.avgTicket), `${kpis.totalEstimates} total`)}</div><div style="background:#fff;border:1px solid #e7edf3;border-radius:12px;padding:16px;margin:12px 0"><h3 style="margin:0 0 8px">Monthly revenue projection</h3>${barRows(revProj, "value")}</div><div style="display:flex;flex-wrap:wrap;gap:12px"><div style="flex:1 1 360px;background:#fff;border:1px solid #e7edf3;border-radius:12px;padding:16px"><h3 style="margin:0 0 8px">Estimates by frequency</h3>${barRows(byFreq, "count")}</div><div style="flex:1 1 360px;background:#fff;border:1px solid #e7edf3;border-radius:12px;padding:16px"><h3 style="margin:0 0 8px">Estimates by city / tier</h3>${barRows(byTier, "count")}</div></div><div style="background:#fff;border:1px solid #e7edf3;border-radius:12px;padding:16px;margin:12px 0"><h3 style="margin:0 0 8px">Calibration (Admin)</h3><p style="color:#5b6b7b;font-size:14px">Avg actual labor ${calSummary.avgActualLaborPct != null ? percent(calSummary.avgActualLaborPct, 1) : "—"} vs target ${percent(MARGIN.targetLaborPct, 0)} · on target/rich/thin: ${calSummary.inBandCount}/${calSummary.underBandCount}/${calSummary.overBandCount} · ${calSummary.jobsWithActuals} jobs logged</p></div></div></body></html>`;
    writeFileSync(path.join(TMP, "sample-dashboard.html"), html, "utf8");

    // ---- Print summary ----
    const lines = [
      "",
      "===== PHASE 3 DASHBOARD (sample jobs) =====",
      `Estimates today: ${kpis.estimatesToday} · this month: ${kpis.estimatesThisMonth} · total: ${kpis.totalEstimates}`,
      `Projected monthly recurring: ${currency0(kpis.projectedMonthlyRecurring)}`,
      `Conversion: ${percent(kpis.conversionRate, 0)} (${kpis.conversionApproved} approved / ${kpis.conversionProposed} proposed)`,
      `Avg ticket: ${currency0(kpis.avgTicket)}`,
      "",
      "By frequency: " + byFreq.map((b) => `${b.label} ${b.count}`).join(", "),
      "By city/tier: " + byTier.map((b) => `${b.label} ${b.count}`).join(", "),
      "Revenue projection: " + revProj.map((b) => `${b.label} ${currency0(b.value)}`).join(" | "),
      "",
      "===== CALIBRATION =====",
      `Jobs with actuals: ${calSummary.jobsWithActuals} · avg actual labor ${calSummary.avgActualLaborPct != null ? percent(calSummary.avgActualLaborPct, 1) : "—"} (target ${percent(MARGIN.targetLaborPct, 0)})`,
      `On target/rich/thin: ${calSummary.inBandCount}/${calSummary.underBandCount}/${calSummary.overBandCount} · total revenue ${currency0(calSummary.totalActualRevenue)} · labor ${currency0(calSummary.totalActualLaborCost)}`,
      "",
      "===== CLEANER EARNINGS =====",
      `Completed: ${earnings.completedCount} · total ${currency0(earnings.totalEarnings)} · hours ${earnings.totalHours} · avg/job ${currency0(earnings.avgPerJob)}`,
      "",
      `Wrote tmp/sample-dashboard.html + ${Object.keys(csvFiles).length} report CSVs.`,
      "",
    ];
    console.log(lines.join("\n"));
  });
});
