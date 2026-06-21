import "server-only";

/**
 * Reports data service (Phase 3) — reuses the dashboard estimate-row fetch and
 * the pure report aggregations, and turns each report into a downloadable CSV
 * (BUILD_SPEC §G — "CSV/Excel export"). Used by the reports page (tables) and
 * the export route handler (CSV download).
 */
import { getEstimateRows } from "@/lib/dashboard/service";
import type { EstimateRow } from "@/lib/dashboard/aggregate";
import {
  avgTicketReport,
  conversionReport,
  estimateCountsByPeriod,
  revenueProjectionReport,
  topCities,
  type Period,
} from "./aggregate";
import { toCsv } from "./csv";

export async function getReportRows(organizationId: string): Promise<EstimateRow[]> {
  return getEstimateRows(organizationId);
}

export interface ReportData {
  byDay: ReturnType<typeof estimateCountsByPeriod>;
  byWeek: ReturnType<typeof estimateCountsByPeriod>;
  byMonth: ReturnType<typeof estimateCountsByPeriod>;
  conversion: ReturnType<typeof conversionReport>;
  revenueProjection: ReturnType<typeof revenueProjectionReport>;
  cities: ReturnType<typeof topCities>;
  avgTicket: ReturnType<typeof avgTicketReport>;
  totalEstimates: number;
}

export function buildReportData(rows: EstimateRow[]): ReportData {
  return {
    byDay: estimateCountsByPeriod(rows, "day"),
    byWeek: estimateCountsByPeriod(rows, "week"),
    byMonth: estimateCountsByPeriod(rows, "month"),
    conversion: conversionReport(rows),
    revenueProjection: revenueProjectionReport(rows),
    cities: topCities(rows, 15),
    avgTicket: avgTicketReport(rows),
    totalEstimates: rows.length,
  };
}

export async function getReportData(organizationId: string): Promise<ReportData> {
  return buildReportData(await getReportRows(organizationId));
}

export const REPORT_TYPES = [
  "estimates-daily",
  "estimates-weekly",
  "estimates-monthly",
  "revenue-projection",
  "conversion",
  "top-cities",
  "avg-ticket",
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export function isReportType(value: string): value is ReportType {
  return (REPORT_TYPES as readonly string[]).includes(value);
}

const PERIOD_BY_TYPE: Partial<Record<ReportType, Period>> = {
  "estimates-daily": "day",
  "estimates-weekly": "week",
  "estimates-monthly": "month",
};

/** Build a named CSV for one report type from already-fetched rows. */
export function buildReportCsv(type: ReportType, rows: EstimateRow[]): { filename: string; csv: string } {
  const stamp = new Date().toISOString().slice(0, 10);
  const file = (name: string) => `clear-horizon-${name}-${stamp}.csv`;

  const period = PERIOD_BY_TYPE[type];
  if (period) {
    const data = estimateCountsByPeriod(rows, period);
    return {
      filename: file(type),
      csv: toCsv(["Period", "Estimates", "Total headline value"], data.map((r) => [r.label, r.count, r.totalValue])),
    };
  }

  switch (type) {
    case "revenue-projection": {
      const r = revenueProjectionReport(rows);
      const body = r.rows.map((x) => [x.customer, x.frequency, x.perVisit, x.projectedMonthly]);
      body.push(["TOTAL", "", "", r.totalMonthly]);
      body.push(["TOTAL (annualized)", "", "", r.totalAnnual]);
      return {
        filename: file("revenue-projection"),
        csv: toCsv(["Customer", "Frequency", "Per visit", "Projected monthly"], body),
      };
    }
    case "conversion": {
      const c = conversionReport(rows);
      return {
        filename: file("conversion"),
        csv: toCsv(
          ["Metric", "Value"],
          [
            ["Total estimates", c.total],
            ["Saved (no proposal)", c.saved],
            ["Proposed", c.proposed],
            ["Approved", c.approved],
            ["Declined", c.declined],
            ["Expired", c.expired],
            ["Reached a proposal", c.proposedPlus],
            ["Conversion rate", `${(c.conversionRate * 100).toFixed(1)}%`],
          ],
        ),
      };
    }
    case "top-cities": {
      const cities = topCities(rows, 100);
      return {
        filename: file("top-cities"),
        csv: toCsv(["City / Tier", "Estimates", "Total headline value"], cities.map((c) => [c.city, c.count, c.totalValue])),
      };
    }
    case "avg-ticket": {
      const t = avgTicketReport(rows);
      return {
        filename: file("avg-ticket"),
        csv: toCsv(["Segment", "Estimates", "Avg headline", "Avg total"], t.map((r) => [r.segment, r.count, r.avgHeadline, r.avgTotal])),
      };
    }
    default:
      throw new Error(`Unknown report type: ${type}`);
  }
}
