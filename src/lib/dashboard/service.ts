import "server-only";

/**
 * Dashboard data service (Phase 3) — fetches org-scoped estimates + jobs and
 * runs the pure aggregations (aggregate.ts). The Prisma `Decimal` → `number`
 * mapping happens HERE so the pure module stays DB-free and unit-testable.
 */
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { ResidentialQuoteResult } from "@/lib/pricing";
import {
  buildActivityFeed,
  computeDashboardKpis,
  estimatesByFrequency,
  estimatesByTier,
  monthlyRevenueProjection,
  type EstimateRow,
  type JobRow,
} from "./aggregate";

type DecimalLike = { toNumber(): number };
const num = (d: DecimalLike): number => d.toNumber();
const numOrNull = (d: DecimalLike | null): number | null => (d == null ? null : d.toNumber());

/** The estimate columns the analytics need (denormalized headline + customer + result). */
const estimateSelect = {
  id: true,
  createdAt: true,
  category: true,
  status: true,
  headlinePrice: true,
  total: true,
  isRecurring: true,
  projectedMonthly: true,
  frequencyLabel: true,
  resultJson: true,
  customer: { select: { name: true, city: true } },
} satisfies Prisma.EstimateSelect;

type EstimateForAnalytics = Prisma.EstimateGetPayload<{ select: typeof estimateSelect }>;

/** Map a Prisma estimate row → the pure EstimateRow (incl. market-tier label). */
export function toEstimateRow(e: EstimateForAnalytics): EstimateRow {
  let tierLabel: string | null = null;
  if (e.category === "Residential") {
    const result = e.resultJson as unknown as ResidentialQuoteResult | null;
    tierLabel = result?.marketTier?.label ?? null;
  }
  return {
    id: e.id,
    createdAt: e.createdAt,
    category: e.category,
    status: e.status,
    headlinePrice: num(e.headlinePrice),
    total: num(e.total),
    isRecurring: e.isRecurring,
    projectedMonthly: numOrNull(e.projectedMonthly),
    frequencyLabel: e.frequencyLabel,
    city: e.customer?.city ?? null,
    tierLabel,
    customerName: e.customer?.name ?? null,
  };
}

/** Fetch the org's estimates mapped to analytics rows (shared by reports). */
export async function getEstimateRows(organizationId: string): Promise<EstimateRow[]> {
  const estimates = await prisma.estimate.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    select: estimateSelect,
  });
  return estimates.map(toEstimateRow);
}

export interface DashboardData {
  kpis: ReturnType<typeof computeDashboardKpis>;
  byFrequency: ReturnType<typeof estimatesByFrequency>;
  byTier: ReturnType<typeof estimatesByTier>;
  revenueProjection: ReturnType<typeof monthlyRevenueProjection>;
  activity: ReturnType<typeof buildActivityFeed>;
}

export async function getDashboardData(
  organizationId: string,
  now: Date = new Date(),
): Promise<DashboardData> {
  const [estimateRows, jobs] = await Promise.all([
    getEstimateRows(organizationId),
    prisma.job.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 60,
      select: {
        id: true,
        createdAt: true,
        completedAt: true,
        status: true,
        summary: true,
        customerName: true,
      },
    }),
  ]);

  const jobRows: JobRow[] = jobs.map((j) => ({
    id: j.id,
    createdAt: j.createdAt,
    completedAt: j.completedAt,
    status: j.status,
    summary: j.summary,
    customerName: j.customerName,
  }));

  return {
    kpis: computeDashboardKpis(estimateRows, now),
    byFrequency: estimatesByFrequency(estimateRows),
    byTier: estimatesByTier(estimateRows),
    revenueProjection: monthlyRevenueProjection(estimateRows, now, 6),
    activity: buildActivityFeed(estimateRows, jobRows, 12),
  };
}
