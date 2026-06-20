import { describe, expect, it } from "vitest";
import {
  ADD_ONS,
  BATHROOM_BASELINE_BATHS,
  BATHROOM_HOURS_PER_EXTRA_BATH,
  BEDROOM_ADJUSTMENTS,
  CONDITION_MULTIPLIERS,
  DEFAULT_MARKET_TIER_KEY,
  FEATURE_OPTIONS,
  FLOORING_MULTIPLIERS,
  FREQUENCY_MULTIPLIERS,
  MARGIN_CONFIG,
  MARKET_TIERS,
  NAPLES_HOURLY_RATE,
  OCCUPANCY_MULTIPLIERS,
  PET_ADJUSTMENTS,
  PRICING_SETTINGS,
  PROPERTY_TYPES,
  SERVICE_TYPES,
  SQFT_LABOR_TIERS,
  TRAVEL_BRACKETS,
} from "./defaults";

const num = (s: string) => Number(s);
const byKey = <T extends { key: string }>(arr: T[], key: string): T => {
  const found = arr.find((x) => x.key === key);
  if (!found) throw new Error(`missing key: ${key}`);
  return found;
};
const setting = (key: string) => byKey(PRICING_SETTINGS, key);

describe("BUILD_SPEC §E — seeded pricing defaults", () => {
  it("§E.1 Step 1 — sqft labor tiers", () => {
    const expected = [
      [0, 1000, 2.5],
      [1001, 1500, 3.25],
      [1501, 2000, 4.0],
      [2001, 2500, 5.0],
      [2501, 3000, 6.0],
      [3001, 4000, 7.5],
      [4001, 5000, 9.0],
    ];
    for (const [min, max, hours] of expected) {
      const tier = SQFT_LABOR_TIERS.find((t) => t.minSqft === min && t.maxSqft === max);
      expect(tier, `tier ${min}-${max}`).toBeDefined();
      expect(tier!.baseHours).toBe(hours);
    }
    // Open-ended tier: 9.0 + ((sqft - 5000) / 500 * 1.25)
    const open = SQFT_LABOR_TIERS.find((t) => t.maxSqft === null)!;
    expect(open.minSqft).toBe(5001);
    expect(open.baseHours).toBe(9.0);
    expect(open.thresholdSqft).toBe(5000);
    expect(open.stepSqft).toBe(500);
    expect(open.stepHours).toBe(1.25);
  });

  it("§E.1 Step 2 — bathroom rule", () => {
    expect(BATHROOM_BASELINE_BATHS).toBe(2);
    expect(BATHROOM_HOURS_PER_EXTRA_BATH).toBe(0.25);
  });

  it("§E.1 Step 3 — bedroom adjustments (1-3→0, 4→0.25, 5→0.5, 6+→1.0)", () => {
    expect(BEDROOM_ADJUSTMENTS.find((b) => b.minBeds === 1 && b.maxBeds === 3)!.hours).toBe(0);
    expect(BEDROOM_ADJUSTMENTS.find((b) => b.minBeds === 4 && b.maxBeds === 4)!.hours).toBe(0.25);
    expect(BEDROOM_ADJUSTMENTS.find((b) => b.minBeds === 5 && b.maxBeds === 5)!.hours).toBe(0.5);
    expect(BEDROOM_ADJUSTMENTS.find((b) => b.minBeds === 6 && b.maxBeds === null)!.hours).toBe(1.0);
  });

  it("§E.1 Step 4 — pets", () => {
    expect(byKey(PET_ADJUSTMENTS, "None").hours).toBe(0);
    expect(byKey(PET_ADJUSTMENTS, "One").hours).toBe(0.5);
    expect(byKey(PET_ADJUSTMENTS, "TwoPlus").hours).toBe(1.0);
    expect(byKey(PET_ADJUSTMENTS, "HeavyShedding").hours).toBe(1.5);
  });

  it("§E.1 Step 5 — features (incl. Elevator 0.10)", () => {
    expect(byKey(FEATURE_OPTIONS, "Stairs").hours).toBe(0.5);
    expect(byKey(FEATURE_OPTIONS, "Elevator").hours).toBe(0.1);
    expect(byKey(FEATURE_OPTIONS, "HomeOffice").hours).toBe(0.25);
    expect(byKey(FEATURE_OPTIONS, "Gym").hours).toBe(0.25);
    expect(byKey(FEATURE_OPTIONS, "Theater").hours).toBe(0.25);
    expect(byKey(FEATURE_OPTIONS, "Lanai").hours).toBe(0.5);
    expect(byKey(FEATURE_OPTIONS, "PoolBath").hours).toBe(0.25);
  });

  it("§E.1 Step 7 — occupancy multipliers", () => {
    expect(byKey(OCCUPANCY_MULTIPLIERS, "SeasonalEmpty").multiplier).toBe(0.9);
    expect(byKey(OCCUPANCY_MULTIPLIERS, "Couple").multiplier).toBe(1.0);
    expect(byKey(OCCUPANCY_MULTIPLIERS, "Family").multiplier).toBe(1.1);
    expect(byKey(OCCUPANCY_MULTIPLIERS, "LargeFamily").multiplier).toBe(1.2);
    expect(byKey(OCCUPANCY_MULTIPLIERS, "VacationRental").multiplier).toBe(1.15);
  });

  it("§E.1 Step 8 — flooring multipliers", () => {
    expect(byKey(FLOORING_MULTIPLIERS, "Tile").multiplier).toBe(1.0);
    expect(byKey(FLOORING_MULTIPLIERS, "Hardwood").multiplier).toBe(1.05);
    expect(byKey(FLOORING_MULTIPLIERS, "Carpet").multiplier).toBe(1.1);
    expect(byKey(FLOORING_MULTIPLIERS, "LuxuryMixed").multiplier).toBe(1.15);
  });

  it("§E.1 Step 9 — condition multipliers", () => {
    expect(byKey(CONDITION_MULTIPLIERS, "Excellent").multiplier).toBe(0.9);
    expect(byKey(CONDITION_MULTIPLIERS, "Average").multiplier).toBe(1.0);
    expect(byKey(CONDITION_MULTIPLIERS, "Dirty").multiplier).toBe(1.2);
    expect(byKey(CONDITION_MULTIPLIERS, "VeryDirty").multiplier).toBe(1.5);
  });

  it("§E.1 Step 13 / §E.2 — frequency multipliers + visits/month", () => {
    const weekly = byKey(FREQUENCY_MULTIPLIERS, "Weekly");
    expect(weekly.multiplier).toBe(0.9);
    expect(weekly.visitsPerMonth).toBe(4.33);
    const biweekly = byKey(FREQUENCY_MULTIPLIERS, "Biweekly");
    expect(biweekly.multiplier).toBe(1.0);
    expect(biweekly.visitsPerMonth).toBe(2.17);
    const monthly = byKey(FREQUENCY_MULTIPLIERS, "Monthly");
    expect(monthly.multiplier).toBe(1.2);
    expect(monthly.visitsPerMonth).toBe(1.0);
    const std = byKey(FREQUENCY_MULTIPLIERS, "OneTimeStandard");
    expect(std.multiplier).toBe(1.35);
    expect(std.isOneTime).toBe(true);
    const deep = byKey(FREQUENCY_MULTIPLIERS, "OneTimeDeep");
    expect(deep.multiplier).toBe(1.75);
    expect(deep.isDeepClean).toBe(true);
  });

  it("§E.3 / §E.19 — market tiers (Naples rate $85 locked; FM/Luxury owner-confirmed)", () => {
    const fm = byKey(MARKET_TIERS, "FortMyers");
    expect(fm.hourlyRate).toBe(70);
    expect(fm.minimumCharge).toBe(175);
    expect(fm.isProvisional).toBe(false);
    const naples = byKey(MARKET_TIERS, "Naples");
    expect(naples.hourlyRate).toBe(85);
    expect(naples.hourlyRate).toBe(NAPLES_HOURLY_RATE);
    expect(naples.minimumCharge).toBe(225);
    expect(naples.isProvisional).toBe(false);
    const lux = byKey(MARKET_TIERS, "LuxuryNaples");
    expect(lux.hourlyRate).toBe(110);
    expect(lux.minimumCharge).toBe(300);
    expect(lux.isProvisional).toBe(false);
    expect(DEFAULT_MARKET_TIER_KEY).toBe("Naples");
  });

  it("§E.1 Step 17 — add-ons (windows & fans are per-unit)", () => {
    expect(byKey(ADD_ONS, "Oven").price).toBe(50);
    expect(byKey(ADD_ONS, "Refrigerator").price).toBe(50);
    const windows = byKey(ADD_ONS, "InteriorWindows");
    expect(windows.price).toBe(8);
    expect(windows.unit).toBe("PerUnit");
    expect(byKey(ADD_ONS, "Baseboards").price).toBe(75);
    const fans = byKey(ADD_ONS, "CeilingFans");
    expect(fans.price).toBe(5);
    expect(fans.unit).toBe("PerUnit");
    expect(byKey(ADD_ONS, "InsideCabinets").price).toBe(100);
    expect(byKey(ADD_ONS, "Laundry").price).toBe(50);
    expect(byKey(ADD_ONS, "Linens").price).toBe(25);
  });

  it("§E.1 Step 16 — travel brackets (30+ flags manual review)", () => {
    expect(TRAVEL_BRACKETS.find((b) => b.minMiles === 0 && b.maxMiles === 10)!.fee).toBe(0);
    expect(TRAVEL_BRACKETS.find((b) => b.minMiles === 10 && b.maxMiles === 20)!.fee).toBe(25);
    expect(TRAVEL_BRACKETS.find((b) => b.minMiles === 20 && b.maxMiles === 30)!.fee).toBe(50);
    const open = TRAVEL_BRACKETS.find((b) => b.maxMiles === null)!;
    expect(open.minMiles).toBe(30);
    expect(open.requiresManualReview).toBe(true);
  });

  it("§E.5 — service taxable flags (residential false, commercial true)", () => {
    expect(SERVICE_TYPES.find((s) => s.key === "Residential")!.taxable).toBe(false);
    expect(SERVICE_TYPES.find((s) => s.key === "Commercial")!.taxable).toBe(true);
  });

  it("§E.7 — property types default to multiplier 1.0", () => {
    expect(PROPERTY_TYPES.length).toBeGreaterThan(0);
    for (const p of PROPERTY_TYPES) expect(p.multiplier).toBe(1.0);
  });

  it("§E.10 / §E.14 / §E.21 — scalar knobs", () => {
    expect(setting("intensity.rule").value).toBe("max");
    expect(num(setting("intensity.cap").value)).toBe(1.75);
    expect(num(setting("rounding.increment").value)).toBe(25);
    expect(setting("rounding.mode").value).toBe("ceil");
    expect(num(setting("seasonal.peakMultiplier").value)).toBe(1.1);
    expect(num(setting("seasonal.offMultiplier").value)).toBe(1.0);
    expect(JSON.parse(setting("seasonal.peakMonths").value)).toEqual([11, 12, 1, 2, 3, 4]);
  });

  it("§E.6 — margin config (Admin-only seeds)", () => {
    expect(MARGIN_CONFIG.laborCostPerHour).toBe(22);
    expect(MARGIN_CONFIG.suppliesPerVisit).toBe(10);
    expect(MARGIN_CONFIG.targetLaborPct).toBe(0.5);
    expect(MARGIN_CONFIG.laborBandMin).toBe(0.4);
    expect(MARGIN_CONFIG.laborBandMax).toBe(0.6);
  });
});

/**
 * Regression fixture (CLAUDE.md §5): proves the SEEDED DEFAULTS reproduce the
 * canonical quote. This computes the arithmetic inline from the defaults — it is
 * NOT the pricing engine (that is Phase 1). If this drifts, the seed values have
 * drifted from the spec.
 *
 * 2,200 sqft / 3 bed / 2.5 bath / biweekly / Naples / average / 1 pet / no add-ons
 * (occupancy Couple, flooring Tile, seasonal off) → base 5.0, production 5.625,
 * base price $478.13, final rounded $500.
 */
describe("CLAUDE.md §5 — fixture consistency from defaults", () => {
  it("produces base 5.0 hrs, production 5.625 hrs, $478.13, rounded $500", () => {
    const sqft = 2200;
    const baths = 2.5;
    const beds = 3;

    const baseTier = SQFT_LABOR_TIERS.find(
      (t) => sqft >= t.minSqft && (t.maxSqft === null || sqft <= t.maxSqft),
    )!;
    const baseLabor = baseTier.baseHours;
    expect(baseLabor).toBe(5.0);

    const bathHours = Math.max(0, baths - BATHROOM_BASELINE_BATHS) * BATHROOM_HOURS_PER_EXTRA_BATH;
    const bedHours = BEDROOM_ADJUSTMENTS.find(
      (b) => beds >= b.minBeds && (b.maxBeds === null || beds <= b.maxBeds),
    )!.hours;
    const petHours = byKey(PET_ADJUSTMENTS, "One").hours;
    const featureHours = 0;

    const laborHours = baseLabor + bathHours + bedHours + petHours + featureHours;
    expect(laborHours).toBe(5.625);

    const occupancy = byKey(OCCUPANCY_MULTIPLIERS, "Couple").multiplier;
    const flooring = byKey(FLOORING_MULTIPLIERS, "Tile").multiplier;
    const condition = byKey(CONDITION_MULTIPLIERS, "Average").multiplier;
    // Not a deep clean → reconciled intensity is just the condition multiplier.
    const intensity = condition;
    const productionHours = laborHours * occupancy * flooring * intensity;
    expect(productionHours).toBe(5.625);

    const rate = byKey(MARKET_TIERS, "Naples").hourlyRate;
    const frequency = byKey(FREQUENCY_MULTIPLIERS, "Biweekly").multiplier;
    const seasonalOff = num(setting("seasonal.offMultiplier").value); // June = off-season
    const basePrice = productionHours * rate * frequency * seasonalOff;
    expect(basePrice).toBeCloseTo(478.13, 2);
    expect(Math.round(basePrice * 100) / 100).toBe(478.13);

    const increment = num(setting("rounding.increment").value);
    const rounded = Math.ceil(basePrice / increment) * increment; // §E.21 round UP
    expect(rounded).toBe(500);

    // Residential is non-taxable (§E.5) → final price equals the rounded pre-tax price.
    expect(SERVICE_TYPES.find((s) => s.key === "Residential")!.taxable).toBe(false);
  });
});
