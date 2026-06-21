/**
 * The calibration loop (BUILD_SPEC §E intro + §G Phase 3) — a PURE module.
 *
 * Mirrors the Clear Horizon calibration workbook: for each real job we log the
 * ACTUAL crew hours, ACTUAL labor $, and the price actually charged, then surface
 * the realised labor % and margin against the 50% target (band 40–60%, §E.6) and
 * the estimated-vs-actual variance. As real jobs accumulate, the owners can see
 * whether the seeded pricing is running rich or thin and re-tune Admin → Pricing.
 *
 * No Prisma, no `server-only`, no React — operates on plain numbers so it is
 * fully unit-testable without a database (CLAUDE.md §3.2). The service layer maps
 * Prisma `Decimal`s to numbers and calls in.
 *
 * ADMIN-ONLY: everything here is internal economics. The app must never render a
 * calibration result to Office Staff, Cleaners, or customers (CLAUDE.md §3.5).
 */
import { roundToCents } from "@/lib/pricing";

export interface MarginParams {
  laborCostPerHour: number; // §E.6 blended cost per crew-hour (seed $22)
  suppliesPerVisit: number; // §E.6 (seed $10)
  targetLaborPct: number; // 0.50
  laborBandMin: number; // 0.40
  laborBandMax: number; // 0.60
}

/** The figures logged (or snapshotted) for one job. Any actual may be null. */
export interface JobCalibrationInput {
  // Estimated economics, snapshotted from the estimate at job creation.
  quotedPrice: number;
  estProductionHours: number | null;
  estLaborCost: number | null;

  // Actuals logged after the job runs (the calibration inputs).
  priceCharged: number | null;
  actualCrewHours: number | null;
  /** Total $ paid for labor. If null, derived as actualCrewHours × laborCostPerHour. */
  actualLaborCost: number | null;
  /** If null, falls back to margin.suppliesPerVisit. */
  actualSuppliesCost: number | null;
}

export type BandStatus = "under" | "in" | "over";

export interface JobCalibrationResult {
  /** True once we have enough to compute a labor % (a price + hours or labor $). */
  hasActuals: boolean;

  // Resolved actuals actually used in the math.
  priceCharged: number | null;
  actualCrewHours: number | null;
  actualLaborCost: number | null; // resolved (may be derived from hours)
  actualSuppliesCost: number; // resolved (falls back to suppliesPerVisit)
  actualTotalCost: number | null;

  // Realised ratios.
  actualLaborPct: number | null; // labor / price
  actualMargin: number | null; // price − totalCost ($)
  actualMarginPct: number | null; // margin / price

  // Target + band (from §E.6).
  targetLaborPct: number;
  laborBandMin: number;
  laborBandMax: number;
  /**
   * Where realised labor % sits vs. the band: "under" = labor below the band
   * (margin running RICH — we may be leaving money in / overpricing capacity),
   * "over" = labor above the band (margin running THIN), "in" = healthy.
   */
  bandStatus: BandStatus | null;
  outOfBand: boolean | null;

  // Estimated-vs-actual variance (actual − estimated).
  priceVariance: number | null; // priceCharged − quotedPrice
  hoursVariance: number | null; // actualCrewHours − estProductionHours
  laborCostVariance: number | null; // resolved labor − estLaborCost
}

function classifyBand(laborPct: number, min: number, max: number): BandStatus {
  if (laborPct < min) return "under";
  if (laborPct > max) return "over";
  return "in";
}

/** Compute the calibration result for a single job. Deterministic given inputs. */
export function computeJobCalibration(
  input: JobCalibrationInput,
  margin: MarginParams,
): JobCalibrationResult {
  const { priceCharged, actualCrewHours } = input;

  // Resolve labor cost: explicit if logged, else derive from crew hours.
  const resolvedLaborCost =
    input.actualLaborCost != null
      ? roundToCents(input.actualLaborCost)
      : actualCrewHours != null
        ? roundToCents(actualCrewHours * margin.laborCostPerHour)
        : null;

  const resolvedSupplies = roundToCents(input.actualSuppliesCost ?? margin.suppliesPerVisit);

  // We can produce a labor %/margin once we have a price AND a labor figure.
  const hasActuals = priceCharged != null && priceCharged > 0 && resolvedLaborCost != null;

  const actualTotalCost =
    resolvedLaborCost != null ? roundToCents(resolvedLaborCost + resolvedSupplies) : null;

  const actualLaborPct =
    hasActuals && resolvedLaborCost != null ? resolvedLaborCost / (priceCharged as number) : null;

  const actualMargin =
    priceCharged != null && actualTotalCost != null
      ? roundToCents(priceCharged - actualTotalCost)
      : null;

  const actualMarginPct =
    actualMargin != null && priceCharged != null && priceCharged > 0
      ? actualMargin / priceCharged
      : null;

  const bandStatus =
    actualLaborPct != null
      ? classifyBand(actualLaborPct, margin.laborBandMin, margin.laborBandMax)
      : null;

  return {
    hasActuals,
    priceCharged: priceCharged ?? null,
    actualCrewHours: actualCrewHours ?? null,
    actualLaborCost: resolvedLaborCost,
    actualSuppliesCost: resolvedSupplies,
    actualTotalCost,
    actualLaborPct,
    actualMargin,
    actualMarginPct,
    targetLaborPct: margin.targetLaborPct,
    laborBandMin: margin.laborBandMin,
    laborBandMax: margin.laborBandMax,
    bandStatus,
    outOfBand: bandStatus != null ? bandStatus !== "in" : null,
    priceVariance:
      priceCharged != null ? roundToCents(priceCharged - input.quotedPrice) : null,
    hoursVariance:
      actualCrewHours != null && input.estProductionHours != null
        ? Math.round((actualCrewHours - input.estProductionHours) * 1000) / 1000
        : null,
    laborCostVariance:
      resolvedLaborCost != null && input.estLaborCost != null
        ? roundToCents(resolvedLaborCost - input.estLaborCost)
        : null,
  };
}

export interface CalibrationSummary {
  jobsWithActuals: number;
  avgActualLaborPct: number | null;
  avgActualMarginPct: number | null;
  inBandCount: number;
  underBandCount: number;
  overBandCount: number;
  avgPriceVariance: number | null;
  avgHoursVariance: number | null;
  totalActualRevenue: number;
  totalActualLaborCost: number;
  targetLaborPct: number;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** Portfolio roll-up across logged jobs — the workbook's summary row. */
export function summarizeCalibration(
  results: JobCalibrationResult[],
  margin: MarginParams,
): CalibrationSummary {
  const withActuals = results.filter((r) => r.hasActuals);
  const laborPcts = withActuals.map((r) => r.actualLaborPct).filter((v): v is number => v != null);
  const marginPcts = withActuals.map((r) => r.actualMarginPct).filter((v): v is number => v != null);
  const priceVars = withActuals.map((r) => r.priceVariance).filter((v): v is number => v != null);
  const hoursVars = withActuals.map((r) => r.hoursVariance).filter((v): v is number => v != null);

  const avgPrice = mean(priceVars);
  const avgHours = mean(hoursVars);

  return {
    jobsWithActuals: withActuals.length,
    avgActualLaborPct: mean(laborPcts),
    avgActualMarginPct: mean(marginPcts),
    inBandCount: withActuals.filter((r) => r.bandStatus === "in").length,
    underBandCount: withActuals.filter((r) => r.bandStatus === "under").length,
    overBandCount: withActuals.filter((r) => r.bandStatus === "over").length,
    avgPriceVariance: avgPrice == null ? null : roundToCents(avgPrice),
    avgHoursVariance: avgHours == null ? null : Math.round(avgHours * 1000) / 1000,
    totalActualRevenue: roundToCents(
      withActuals.reduce((s, r) => s + (r.priceCharged ?? 0), 0),
    ),
    totalActualLaborCost: roundToCents(
      withActuals.reduce((s, r) => s + (r.actualLaborCost ?? 0), 0),
    ),
    targetLaborPct: margin.targetLaborPct,
  };
}
