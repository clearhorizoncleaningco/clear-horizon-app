import { beforeEach, describe, expect, it } from "vitest";
import {
  buildConfigFromDefaults,
  computeCommercialQuote,
  computeResidentialQuote,
  PricingError,
  reconcileIntensity,
  resolveBaseLaborHours,
  resolveMarketTier,
  resolveTravel,
  roundToCents,
  roundUpToIncrement,
  type PricingConfig,
  type ResidentialQuoteInput,
} from "./index";

// June 20, 2026 — off-season (May–Oct), so seasonal multiplier = 1.00 (§E.14).
const FIXTURE_DATE = new Date(2026, 5, 20);

let config: PricingConfig;
beforeEach(() => {
  config = buildConfigFromDefaults();
});

/** A clean baseline residential input; override only what a test cares about. */
function makeInput(overrides: Partial<ResidentialQuoteInput> = {}): ResidentialQuoteInput {
  return {
    sqft: 2200,
    bedrooms: 3,
    bathrooms: 2,
    marketTierKeyOverride: "Naples",
    occupancyKey: "Couple",
    flooringKey: "Tile",
    conditionKey: "Average",
    petKey: "None",
    featureKeys: [],
    frequencyKey: "Biweekly",
    addOns: [],
    seasonalOverride: null,
    quoteDate: FIXTURE_DATE,
    ...overrides,
  };
}

// ============================================================================
// CLAUDE.md §5 — THE PERMANENT REGRESSION FIXTURE (must hold to the dollar)
// ============================================================================
describe("CLAUDE.md §5 fixture — engine reproduces it to the dollar", () => {
  it("2200sqft/3bd/2.5ba/biweekly/Naples/average/1 pet → base 5.0, prod 5.625, $478.13, $500", () => {
    const result = computeResidentialQuote(
      makeInput({ bathrooms: 2.5, petKey: "One" }),
      config,
    );
    const line = result.primary;

    expect(line.baseLaborHours).toBe(5.0);
    expect(line.laborHours).toBe(5.625);
    expect(line.productionHours).toBe(5.625);
    expect(line.basePrice).toBeCloseTo(478.13, 2);
    expect(line.preTaxPrice).toBe(500);

    // Residential is non-taxable (§E.5) → final price is the rounded pre-tax price.
    expect(line.taxable).toBe(false);
    expect(line.taxAmount).toBe(0);
    expect(line.total).toBe(500);

    expect(result.marketTier.key).toBe("Naples");
    expect(result.marketTier.hourlyRate).toBe(85);
  });
});

// ============================================================================
// §E.1 Step 1 — sqft labor tiers (incl. the >5000 overflow formula)
// ============================================================================
describe("§E.1 Step 1 — base labor hours by sqft", () => {
  it.each([
    [800, 2.5],
    [1000, 2.5],
    [1001, 3.25],
    [1200, 3.25],
    [1750, 4.0],
    [2200, 5.0],
    [2800, 6.0],
    [3500, 7.5],
    [4500, 9.0],
    [5000, 9.0],
  ])("sqft %i → %f base hours", (sqft, hours) => {
    expect(resolveBaseLaborHours(sqft, config)).toBe(hours);
  });

  it(">5000 uses 9.0 + ((sqft-5000)/500 * 1.25)", () => {
    expect(resolveBaseLaborHours(5500, config)).toBeCloseTo(10.25, 10); // 9 + 1*1.25
    expect(resolveBaseLaborHours(6000, config)).toBeCloseTo(11.5, 10); // 9 + 2*1.25
    expect(resolveBaseLaborHours(5001, config)).toBeCloseTo(9.0025, 10);
  });
});

// ============================================================================
// §E.1 Steps 2–5 — additive hour adjustments
// ============================================================================
describe("§E.1 Step 2 — bathrooms: max(0, baths-2) * 0.25", () => {
  it.each([
    [2, 0],
    [2.5, 0.125],
    [3, 0.25],
    [4, 0.5],
    [1, 0], // below baseline never goes negative
  ])("%f baths → %f hours", (baths, hours) => {
    expect(computeResidentialQuote(makeInput({ bathrooms: baths }), config).primary.bathroomHours).toBeCloseTo(hours, 10);
  });
});

describe("§E.1 Step 3 — bedrooms (1-3→0, 4→0.25, 5→0.5, 6+→1.0)", () => {
  it.each([
    [3, 0],
    [4, 0.25],
    [5, 0.5],
    [6, 1.0],
    [8, 1.0],
  ])("%i beds → %f hours", (beds, hours) => {
    expect(computeResidentialQuote(makeInput({ bedrooms: beds }), config).primary.bedroomHours).toBe(hours);
  });
});

describe("§E.1 Step 4 — pets", () => {
  it.each([
    ["None", 0],
    ["One", 0.5],
    ["TwoPlus", 1.0],
    ["HeavyShedding", 1.5],
  ])("%s → %f hours", (petKey, hours) => {
    expect(computeResidentialQuote(makeInput({ petKey }), config).primary.petHours).toBe(hours);
  });
});

describe("§E.1 Step 5 — features sum (incl. Elevator 0.10)", () => {
  it("sums selected feature hours and lists each line", () => {
    const line = computeResidentialQuote(makeInput({ featureKeys: ["Stairs", "Elevator"] }), config).primary;
    expect(line.featureHours).toBeCloseTo(0.6, 10); // 0.5 + 0.10
    expect(line.featureLines).toHaveLength(2);
  });
  it("Lanai + Pool Bath = 0.75", () => {
    expect(computeResidentialQuote(makeInput({ featureKeys: ["Lanai", "PoolBath"] }), config).primary.featureHours).toBe(0.75);
  });
});

// ============================================================================
// §E.1 Steps 7–9 — production-hour multipliers
// ============================================================================
describe("§E.1 Steps 7–9 — occupancy / flooring / condition multipliers", () => {
  it("occupancy", () => {
    expect(computeResidentialQuote(makeInput({ occupancyKey: "Family" }), config).primary.occupancyMultiplier).toBe(1.1);
    expect(computeResidentialQuote(makeInput({ occupancyKey: "LargeFamily" }), config).primary.occupancyMultiplier).toBe(1.2);
  });
  it("flooring", () => {
    expect(computeResidentialQuote(makeInput({ flooringKey: "Carpet" }), config).primary.flooringMultiplier).toBe(1.1);
    expect(computeResidentialQuote(makeInput({ flooringKey: "LuxuryMixed" }), config).primary.flooringMultiplier).toBe(1.15);
  });
  it("condition", () => {
    expect(computeResidentialQuote(makeInput({ conditionKey: "VeryDirty" }), config).primary.conditionMultiplier).toBe(1.5);
    expect(computeResidentialQuote(makeInput({ conditionKey: "Excellent" }), config).primary.conditionMultiplier).toBe(0.9);
  });
});

// ============================================================================
// §E.10 — intensity reconciliation (max, never product unless configured) + cap
// ============================================================================
describe("§E.10 — intensity reconciliation", () => {
  it("non-deep clean → reconciled intensity is just the condition multiplier", () => {
    expect(reconcileIntensity(1.0, false, config)).toBe(1.0);
    expect(reconcileIntensity(1.5, false, config)).toBe(1.5);
  });
  it("deep clean → max(condition, deepCleanPremium) (default rule)", () => {
    expect(reconcileIntensity(1.0, true, config)).toBe(1.5); // max(1.0, 1.5)
    expect(reconcileIntensity(1.2, true, config)).toBe(1.5); // max(1.2, 1.5)
    expect(reconcileIntensity(1.5, true, config)).toBe(1.5); // max(1.5, 1.5)
  });
  it("never multiplies condition × premium under the default 'max' rule", () => {
    // product would be 1.5 * 1.5 = 2.25; max rule keeps it at 1.5.
    expect(reconcileIntensity(1.5, true, config)).toBe(1.5);
  });
  it("'product' rule multiplies but is capped (default cap 1.75)", () => {
    const productConfig: PricingConfig = { ...config, intensity: { ...config.intensity, rule: "product" } };
    expect(reconcileIntensity(1.0, true, productConfig)).toBe(1.5); // 1.0 * 1.5
    expect(reconcileIntensity(1.5, true, productConfig)).toBe(1.75); // 2.25 capped to 1.75
  });
});

// ============================================================================
// §E.1 Step 13 — frequency multipliers
// ============================================================================
describe("§E.1 Step 13 — frequency multipliers", () => {
  it.each([
    ["Weekly", 0.9],
    ["Biweekly", 1.0],
    ["Monthly", 1.2],
    ["OneTimeStandard", 1.35],
    ["OneTimeDeep", 1.75],
  ])("%s → ×%f", (frequencyKey, mult) => {
    expect(computeResidentialQuote(makeInput({ frequencyKey }), config).primary.frequencyMultiplier).toBe(mult);
  });
});

// ============================================================================
// §E.21 — round pre-tax price UP to the next $25
// ============================================================================
describe("§E.21 — round-up behavior", () => {
  it.each([
    [478.13, 500],
    [500, 500], // already on an increment → unchanged
    [500.01, 525],
    [224.99, 225],
    [0, 0],
    [25, 25],
  ])("roundUpToIncrement(%f, 25) = %i", (value, expected) => {
    expect(roundUpToIncrement(value, 25)).toBe(expected);
  });

  it("roundToCents handles half-up", () => {
    expect(roundToCents(478.125)).toBe(478.13);
    expect(roundToCents(1.005)).toBe(1.01);
  });
});

// ============================================================================
// §E.19 — minimum charge flooring
// ============================================================================
describe("§E.19 — minimum charge flooring", () => {
  it("floors a small Fort Myers job to its $175 minimum", () => {
    const line = computeResidentialQuote(
      makeInput({
        sqft: 800,
        bedrooms: 2,
        bathrooms: 1,
        conditionKey: "Excellent",
        frequencyKey: "Weekly",
        marketTierKeyOverride: "FortMyers",
      }),
      config,
    ).primary;
    expect(line.minimumApplied).toBe(true);
    expect(line.preTaxPrice).toBe(175);
    expect(line.minimumCharge).toBe(175);
  });
});

// ============================================================================
// §E.3 — market tier resolution (override → ZIP → default)
// ============================================================================
describe("§E.3 — market tier resolution", () => {
  it("manual override wins over everything", () => {
    const tier = resolveMarketTier(makeInput({ zip: "33901", marketTierKeyOverride: "LuxuryNaples" }), config);
    expect(tier.key).toBe("LuxuryNaples");
    expect(tier.source).toBe("override");
    expect(tier.hourlyRate).toBe(110);
  });
  it("ZIP mapping resolves when no override", () => {
    const lux = resolveMarketTier(makeInput({ zip: "34102", marketTierKeyOverride: null }), config);
    expect(lux.key).toBe("LuxuryNaples");
    expect(lux.source).toBe("zip");
    const fm = resolveMarketTier(makeInput({ zip: "33901", marketTierKeyOverride: null }), config);
    expect(fm.key).toBe("FortMyers");
    expect(fm.source).toBe("zip");
  });
  it("unmapped ZIP falls back to the org default tier", () => {
    const tier = resolveMarketTier(makeInput({ zip: "99999", marketTierKeyOverride: null }), config);
    expect(tier.key).toBe("Naples");
    expect(tier.source).toBe("default");
  });
});

// ============================================================================
// §E.1 Step 16 / §E.4 — travel brackets (incl. 30+ manual review)
// ============================================================================
describe("§E.16 / §E.4 — travel brackets", () => {
  it.each([
    [0, 0, false],
    [5, 0, false],
    [10, 25, false],
    [15, 25, false],
    [20, 50, false],
    [29, 50, false],
    [30, 0, true],
    [45, 0, true],
  ])("%i miles → $%i (manual review: %s)", (miles, fee, manual) => {
    const t = resolveTravel(miles, config);
    expect(t.fee).toBe(fee);
    expect(t.requiresManualReview).toBe(manual);
  });

  it("travel fee is added into the subtotal", () => {
    const line = computeResidentialQuote(makeInput({ travelMiles: 15 }), config).primary;
    expect(line.travelFee).toBe(25);
    expect(line.subtotal).toBeCloseTo(line.basePrice + 25 + line.addOnsTotal, 2);
  });
});

// ============================================================================
// §E.1 Step 17 — add-ons (quantity-aware; Flat ignores quantity)
// ============================================================================
describe("§E.17 — add-ons", () => {
  it("per-unit add-ons scale by quantity; flat add-ons do not", () => {
    const line = computeResidentialQuote(
      makeInput({
        addOns: [
          { key: "Oven", quantity: 3 }, // Flat $50 → still $50
          { key: "InteriorWindows", quantity: 5 }, // $8 × 5 = $40
          { key: "CeilingFans", quantity: 4 }, // $5 × 4 = $20
        ],
      }),
      config,
    ).primary;
    expect(line.addOnsTotal).toBe(110);
    const oven = line.addOnLines.find((a) => a.key === "Oven")!;
    expect(oven.quantity).toBe(1); // coerced — flat fee
    expect(oven.lineTotal).toBe(50);
    const windows = line.addOnLines.find((a) => a.key === "InteriorWindows")!;
    expect(windows.lineTotal).toBe(40);
  });
  it("ignores zero-quantity selections", () => {
    const line = computeResidentialQuote(makeInput({ addOns: [{ key: "Oven", quantity: 0 }] }), config).primary;
    expect(line.addOnLines).toHaveLength(0);
    expect(line.addOnsTotal).toBe(0);
  });
});

// ============================================================================
// §E.5 — tax (residential non-taxable; commercial taxable)
// ============================================================================
describe("§E.5 — taxability", () => {
  it("residential carries no tax", () => {
    const line = computeResidentialQuote(makeInput(), config).primary;
    expect(line.taxable).toBe(false);
    expect(line.taxRate).toBe(0);
    expect(line.taxAmount).toBe(0);
    expect(line.total).toBe(line.preTaxPrice);
  });
});

// ============================================================================
// §E.2 — recurring services output TWO numbers + projected monthly
// ============================================================================
describe("§E.2 — two-number recurring output", () => {
  it("biweekly fixture: recurring per-visit + separate deep-clean line + projected monthly", () => {
    const result = computeResidentialQuote(makeInput({ bathrooms: 2.5, petKey: "One" }), config);

    expect(result.isRecurring).toBe(true);
    expect(result.primary.preTaxPrice).toBe(500);

    // Separate one-time Initial Deep Clean, priced with the deep premium.
    expect(result.initialDeepClean).not.toBeNull();
    const deep = result.initialDeepClean!;
    expect(deep.isDeepClean).toBe(true);
    expect(deep.frequencyKey).toBe("OneTimeDeep");
    expect(deep.reconciledIntensity).toBe(1.5); // max(condition 1.0, premium 1.5)
    expect(deep.preTaxPrice).toBe(1275); // 5.625 × 1.5 × 85 × 1.75 = 1255.08 → ⌈$25⌉

    // Projected monthly = per-visit × visits/month (biweekly = 2.17).
    expect(result.visitsPerMonth).toBe(2.17);
    expect(result.projectedMonthly).toBe(1085); // 500 × 2.17
  });

  it("a recurring frequency and the deep premium are never multiplied on one line", () => {
    // The recurring (Biweekly) line must NOT carry the deep premium.
    const result = computeResidentialQuote(makeInput({ conditionKey: "Average" }), config);
    expect(result.primary.isDeepClean).toBe(false);
    expect(result.primary.reconciledIntensity).toBe(1.0); // condition only, no premium
    expect(result.primary.deepCleanPremium).toBeNull();
  });

  it("one-time standard: single price, no deep-clean line, no monthly projection", () => {
    const result = computeResidentialQuote(makeInput({ frequencyKey: "OneTimeStandard" }), config);
    expect(result.isRecurring).toBe(false);
    expect(result.initialDeepClean).toBeNull();
    expect(result.projectedMonthly).toBeNull();
    expect(result.visitsPerMonth).toBeNull();
  });

  it("one-time deep: the single price itself carries the deep premium", () => {
    const result = computeResidentialQuote(makeInput({ frequencyKey: "OneTimeDeep" }), config);
    expect(result.isRecurring).toBe(false);
    expect(result.initialDeepClean).toBeNull();
    expect(result.primary.isDeepClean).toBe(true);
    expect(result.primary.reconciledIntensity).toBe(1.5);
  });
});

// ============================================================================
// §E.6 — internal margin (Admin-only)
// ============================================================================
describe("§E.6 — margin computation", () => {
  it("computes labor cost, supplies, margin and flags out-of-band labor %", () => {
    const margin = computeResidentialQuote(makeInput({ bathrooms: 2.5, petKey: "One" }), config).primary.margin;
    expect(margin.estimatedLaborCost).toBe(123.75); // 5.625 prod-hrs × $22
    expect(margin.suppliesPerVisit).toBe(10);
    expect(margin.totalCost).toBe(133.75);
    expect(margin.projectedMargin).toBe(366.25); // 500 − 133.75
    expect(margin.laborPct).toBeCloseTo(0.2475, 4); // 123.75 / 500
    // 24.75% labor is below the 40–60% band → flagged.
    expect(margin.outOfBand).toBe(true);
  });
});

// ============================================================================
// §E.7 — property type captured but has NO pricing effect in v1
// ============================================================================
describe("§E.7 — property type has no pricing effect", () => {
  it("changing the property-type multiplier does not change the price", () => {
    const baseline = computeResidentialQuote(makeInput(), config).primary.preTaxPrice;

    // Forcibly set a non-1.0 multiplier on a property type and select it.
    const altered: PricingConfig = {
      ...config,
      propertyTypes: config.propertyTypes.map((p) =>
        p.key === "Condo" ? { ...p, multiplier: 1.5 } : p,
      ),
    };
    const result = computeResidentialQuote(makeInput({ propertyTypeKey: "Condo" }), altered);

    expect(result.propertyTypeMultiplier).toBe(1.5); // captured…
    expect(result.primary.preTaxPrice).toBe(baseline); // …but NOT applied
  });
});

// ============================================================================
// §E.8 — manual commercial quote path
// ============================================================================
describe("§E.8 — commercial manual quote", () => {
  it("sums line items onto the owner price and applies commercial tax", () => {
    const result = computeCommercialQuote(
      {
        basePrice: 1000,
        lineItems: [
          { description: "Floor strip & wax", amount: 100 },
          { description: "Window cleaning", amount: 50 },
        ],
      },
      config,
    );
    expect(result.lineItemsTotal).toBe(150);
    expect(result.subtotal).toBe(1150);
    expect(result.taxable).toBe(true);
    expect(result.taxRate).toBe(0.06);
    expect(result.taxAmount).toBe(69); // 1150 × 6%
    expect(result.total).toBe(1219);
  });

  it("respects a taxable=false override", () => {
    const result = computeCommercialQuote({ basePrice: 5000, lineItems: [], taxableOverride: false }, config);
    expect(result.taxable).toBe(false);
    expect(result.taxAmount).toBe(0);
    expect(result.total).toBe(5000);
  });
});

// ============================================================================
// Boundary / error handling (CLAUDE.md §3.6 — real error handling)
// ============================================================================
describe("input validation", () => {
  it("rejects non-positive square footage", () => {
    expect(() => computeResidentialQuote(makeInput({ sqft: 0 }), config)).toThrow(PricingError);
  });
  it("throws a clear error for an unknown option key", () => {
    expect(() => computeResidentialQuote(makeInput({ occupancyKey: "Nope" }), config)).toThrow(/occupancy/);
  });
});
