import "server-only";

/**
 * Calibration data service (Phase 3) — loads the org's jobs + margin config and
 * runs the pure calibration math (compute.ts). ADMIN-ONLY at the page layer: it
 * surfaces internal labor %/margin vs. the 50% target (CLAUDE.md §3.5).
 */
import { prisma } from "@/lib/db";
import { jobEconomics } from "@/lib/jobs/service";
import {
  computeJobCalibration,
  summarizeCalibration,
  type JobCalibrationResult,
  type MarginParams,
} from "./compute";

export async function loadMarginParams(organizationId: string): Promise<MarginParams> {
  const cfg = await prisma.marginConfig.findUnique({ where: { organizationId } });
  if (!cfg) throw new Error("Margin config missing for this organization. Run `npm run db:seed`.");
  return {
    laborCostPerHour: cfg.laborCostPerHour.toNumber(),
    suppliesPerVisit: cfg.suppliesPerVisit.toNumber(),
    targetLaborPct: cfg.targetLaborPct.toNumber(),
    laborBandMin: cfg.laborBandMin.toNumber(),
    laborBandMax: cfg.laborBandMax.toNumber(),
  };
}

export type CalibrationJob = Awaited<ReturnType<typeof fetchCalibrationJobs>>[number];

function fetchCalibrationJobs(organizationId: string) {
  return prisma.job.findMany({
    where: { organizationId },
    orderBy: [{ completedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    include: { customer: { select: { name: true } } },
  });
}

export interface CalibrationItem {
  job: CalibrationJob;
  calibration: JobCalibrationResult;
}

export interface CalibrationData {
  items: CalibrationItem[];
  summary: ReturnType<typeof summarizeCalibration>;
  margin: MarginParams;
}

export async function getCalibrationData(organizationId: string): Promise<CalibrationData> {
  const [jobs, margin] = await Promise.all([
    fetchCalibrationJobs(organizationId),
    loadMarginParams(organizationId),
  ]);

  const items: CalibrationItem[] = jobs.map((job) => ({
    job,
    calibration: computeJobCalibration(jobEconomics(job), margin),
  }));

  return {
    items,
    summary: summarizeCalibration(items.map((i) => i.calibration), margin),
    margin,
  };
}
