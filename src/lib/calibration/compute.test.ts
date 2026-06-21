import { describe, expect, it } from "vitest";
import {
  computeJobCalibration,
  summarizeCalibration,
  type JobCalibrationInput,
  type MarginParams,
} from "./compute";

// §E.6 seed margin params.
const MARGIN: MarginParams = {
  laborCostPerHour: 22,
  suppliesPerVisit: 10,
  targetLaborPct: 0.5,
  laborBandMin: 0.4,
  laborBandMax: 0.6,
};

function input(overrides: Partial<JobCalibrationInput> = {}): JobCalibrationInput {
  return {
    quotedPrice: 500,
    estProductionHours: 5.625,
    estLaborCost: 123.75,
    priceCharged: null,
    actualCrewHours: null,
    actualLaborCost: null,
    actualSuppliesCost: null,
    ...overrides,
  };
}

describe("computeJobCalibration", () => {
  it("derives labor cost from crew hours when labor $ not given (§5 fixture job)", () => {
    // Price $500, 6.0 actual crew-hrs @ $22 → labor $132, +$10 supplies = $142.
    const r = computeJobCalibration(input({ priceCharged: 500, actualCrewHours: 6.0 }), MARGIN);
    expect(r.hasActuals).toBe(true);
    expect(r.actualLaborCost).toBe(132);
    expect(r.actualSuppliesCost).toBe(10);
    expect(r.actualTotalCost).toBe(142);
    expect(r.actualLaborPct).toBeCloseTo(0.264, 6); // 132/500
    expect(r.actualMargin).toBe(358); // 500 − 142
    expect(r.actualMarginPct).toBeCloseTo(0.716, 6);
  });

  it("flags labor % below the 40–60% band as 'under' (margin running rich)", () => {
    const r = computeJobCalibration(input({ priceCharged: 500, actualCrewHours: 6.0 }), MARGIN);
    expect(r.bandStatus).toBe("under"); // 26.4% < 40%
    expect(r.outOfBand).toBe(true);
  });

  it("flags labor % above the band as 'over' (margin running thin)", () => {
    // 16 crew-hrs @ $22 = $352 labor on a $500 job → 70.4% labor.
    const r = computeJobCalibration(input({ priceCharged: 500, actualCrewHours: 16 }), MARGIN);
    expect(r.actualLaborPct).toBeCloseTo(0.704, 6);
    expect(r.bandStatus).toBe("over");
    expect(r.outOfBand).toBe(true);
  });

  it("reports 'in' band when labor % lands inside 40–60%", () => {
    // labor $250 on a $500 job → exactly 50%.
    const r = computeJobCalibration(
      input({ priceCharged: 500, actualLaborCost: 250 }),
      MARGIN,
    );
    expect(r.actualLaborPct).toBeCloseTo(0.5, 6);
    expect(r.bandStatus).toBe("in");
    expect(r.outOfBand).toBe(false);
  });

  it("prefers an explicit logged labor $ over deriving from hours", () => {
    const r = computeJobCalibration(
      input({ priceCharged: 500, actualCrewHours: 6, actualLaborCost: 200 }),
      MARGIN,
    );
    expect(r.actualLaborCost).toBe(200); // not 132
  });

  it("honors an explicit supplies override", () => {
    const r = computeJobCalibration(
      input({ priceCharged: 500, actualCrewHours: 6, actualSuppliesCost: 25 }),
      MARGIN,
    );
    expect(r.actualSuppliesCost).toBe(25);
    expect(r.actualTotalCost).toBe(157); // 132 + 25
  });

  it("computes estimated-vs-actual variances", () => {
    const r = computeJobCalibration(
      input({ quotedPrice: 500, priceCharged: 525, estProductionHours: 5.625, actualCrewHours: 6.5, estLaborCost: 123.75 }),
      MARGIN,
    );
    expect(r.priceVariance).toBe(25); // 525 − 500
    expect(r.hoursVariance).toBe(0.875); // 6.5 − 5.625
    expect(r.laborCostVariance).toBeCloseTo(143 - 123.75, 6); // 6.5×22=143
  });

  it("returns hasActuals=false when there is no price or labor figure", () => {
    const r = computeJobCalibration(input({ actualCrewHours: 6 }), MARGIN); // no price
    expect(r.hasActuals).toBe(false);
    expect(r.actualLaborPct).toBeNull();
    expect(r.bandStatus).toBeNull();
    expect(r.outOfBand).toBeNull();
  });
});

describe("summarizeCalibration", () => {
  it("rolls up averages and band counts across jobs", () => {
    const jobs = [
      computeJobCalibration(input({ priceCharged: 500, actualLaborCost: 250 }), MARGIN), // 50% in
      computeJobCalibration(input({ priceCharged: 500, actualLaborCost: 132 }), MARGIN), // 26.4% under
      computeJobCalibration(input({ priceCharged: 500, actualLaborCost: 352 }), MARGIN), // 70.4% over
      computeJobCalibration(input({ priceCharged: null }), MARGIN), // no actuals — excluded
    ];
    const s = summarizeCalibration(jobs, MARGIN);
    expect(s.jobsWithActuals).toBe(3);
    expect(s.inBandCount).toBe(1);
    expect(s.underBandCount).toBe(1);
    expect(s.overBandCount).toBe(1);
    expect(s.avgActualLaborPct).toBeCloseTo((0.5 + 0.264 + 0.704) / 3, 6);
    expect(s.totalActualRevenue).toBe(1500);
    expect(s.totalActualLaborCost).toBe(250 + 132 + 352);
    expect(s.targetLaborPct).toBe(0.5);
  });

  it("returns null averages when no job has actuals", () => {
    const s = summarizeCalibration([computeJobCalibration(input(), MARGIN)], MARGIN);
    expect(s.jobsWithActuals).toBe(0);
    expect(s.avgActualLaborPct).toBeNull();
  });
});
