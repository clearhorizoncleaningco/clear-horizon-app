/**
 * The residential pricing engine (BUILD_SPEC §E) — a PURE, isolated module.
 *
 * Rules it enforces (CLAUDE.md §3):
 *   - No hardcoded pricing: every rate/multiplier/threshold/fee comes from the
 *     passed-in `PricingConfig` (seeded from §E, Admin-editable). The only
 *     literals here are arithmetic constants (100 cents/dollar) and §E's fixed
 *     algorithm (the order of operations), not pricing values.
 *   - Pure: no Prisma, no `server-only`, no React. Deterministic given inputs.
 *
 * Canonical regression fixture (CLAUDE.md §5), proven in engine.test.ts:
 *   2,200 sqft / 3 bed / 2.5 bath / biweekly / Naples / average / 1 pet
 *   → base 5.0 hrs, production 5.625 hrs, base price $478.13, rounded $500.
 */
import type {
  AddOnLine,
  CommercialQuoteInput,
  CommercialQuoteResult,
  FeatureLine,
  MarginResult,
  PricingConfig,
  QuoteLine,
  ResidentialQuoteInput,
  ResidentialQuoteResult,
  ResolvedMarketTier,
  SeasonalOverride,
} from "./types";

/** Raised for invalid pricing inputs / missing config rows (caught at the boundary). */
export class PricingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PricingError";
  }
}

// ----------------------------------------------------------------------------
// Money helpers (cents-based to avoid float drift)
// ----------------------------------------------------------------------------

/** Round to whole cents (half-up). */
export function roundToCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** §E.21 — round a dollar amount UP to the next `increment` (e.g. $25). */
export function roundUpToIncrement(value: number, increment: number): number {
  if (increment <= 0) return roundToCents(value);
  const cents = Math.round(value * 100);
  const incrementCents = Math.round(increment * 100);
  return (Math.ceil(cents / incrementCents) * incrementCents) / 100;
}

// ----------------------------------------------------------------------------
// Lookups
// ----------------------------------------------------------------------------

function findByKey<T extends { key: string }>(rows: T[], key: string, kind: string): T {
  const found = rows.find((r) => r.key === key);
  if (!found) {
    throw new PricingError(`Unknown ${kind} "${key}". Check the wizard input or Admin → Pricing.`);
  }
  return found;
}

/** §E.1 Step 1 — base labor hours by square footage, incl. the >5000 formula. */
export function resolveBaseLaborHours(sqft: number, config: PricingConfig): number {
  const tiers = config.sqftLaborTiers;
  if (tiers.length === 0) throw new PricingError("No sqft labor tiers configured.");

  for (const tier of tiers) {
    if (tier.maxSqft === null) continue;
    if (sqft >= tier.minSqft && sqft <= tier.maxSqft) return tier.baseHours;
  }

  const open = tiers.find((t) => t.maxSqft === null);
  if (open) {
    const threshold = open.thresholdSqft ?? open.minSqft;
    if (sqft > threshold && open.stepSqft && open.stepHours != null) {
      return open.baseHours + ((sqft - threshold) / open.stepSqft) * open.stepHours;
    }
  }

  // Defensive fallbacks (validation should prevent these): below all tiers ->
  // smallest baseHours; above all with no open tier -> largest baseHours.
  const sorted = [...tiers].sort((a, b) => a.minSqft - b.minSqft);
  if (sqft < sorted[0].minSqft) return sorted[0].baseHours;
  return sorted[sorted.length - 1].baseHours;
}

/** §E.1 Step 3 — bedroom adjustment hours by bedroom-count band. */
function resolveBedroomHours(bedrooms: number, config: PricingConfig): number {
  const band = config.bedroomAdjustments.find(
    (b) => bedrooms >= b.minBeds && (b.maxBeds === null || bedrooms <= b.maxBeds),
  );
  return band?.hours ?? 0;
}

/** §E.10 — reconcile condition vs. deep-clean premium (never the product unless configured). */
export function reconcileIntensity(
  conditionMultiplier: number,
  isDeepClean: boolean,
  config: PricingConfig,
): number {
  const { rule, cap, deepCleanPremium } = config.intensity;
  if (!isDeepClean) return Math.min(conditionMultiplier, cap);
  const raw =
    rule === "product"
      ? conditionMultiplier * deepCleanPremium
      : Math.max(conditionMultiplier, deepCleanPremium);
  return Math.min(raw, cap);
}

/** §E.3 — resolve market tier from manual override, then ZIP map, then org default. */
export function resolveMarketTier(input: ResidentialQuoteInput, config: PricingConfig): ResolvedMarketTier {
  let key: string | undefined;
  let source: ResolvedMarketTier["source"] = "default";

  if (input.marketTierKeyOverride) {
    key = input.marketTierKeyOverride;
    source = "override";
  } else if (input.zip) {
    const mapping = config.zipTierMappings.find((m) => m.zip === input.zip);
    if (mapping) {
      key = mapping.tierKey;
      source = "zip";
    }
  }
  if (!key) {
    key = config.defaultMarketTierKey;
    source = "default";
  }

  const tier = config.marketTiers.find((t) => t.key === key);
  if (!tier) {
    throw new PricingError(`Market tier "${key}" is not configured (Admin → Pricing → Market Tiers).`);
  }
  return { key: tier.key, label: tier.label, hourlyRate: tier.hourlyRate, minimumCharge: tier.minimumCharge, source };
}

/** §E.14 — resolve the seasonal multiplier from override, else auto-detect by month. */
export function resolveSeasonal(
  override: SeasonalOverride | null | undefined,
  quoteDate: Date,
  config: PricingConfig,
): { multiplier: number; isPeak: boolean; source: "auto" | "override" } {
  const { peakMultiplier, offMultiplier, peakMonths } = config.seasonal;
  if (override === "peak") return { multiplier: peakMultiplier, isPeak: true, source: "override" };
  if (override === "off") return { multiplier: offMultiplier, isPeak: false, source: "override" };
  const month = quoteDate.getMonth() + 1; // 1-based
  const isPeak = peakMonths.includes(month);
  return { multiplier: isPeak ? peakMultiplier : offMultiplier, isPeak, source: "auto" };
}

/** §E.1 Step 16 — resolve a travel bracket from miles (largest minMiles ≤ miles). */
export function resolveTravel(
  miles: number,
  config: PricingConfig,
): { miles: number; fee: number; requiresManualReview: boolean } {
  const sorted = [...config.travelBrackets].sort((a, b) => a.minMiles - b.minMiles);
  let match = sorted[0];
  for (const bracket of sorted) {
    if (miles >= bracket.minMiles) match = bracket;
  }
  if (!match) return { miles, fee: 0, requiresManualReview: false };
  return { miles, fee: match.fee, requiresManualReview: match.requiresManualReview };
}

function defaultTaxRate(config: PricingConfig): number {
  const def = config.taxRates.find((t) => t.isDefault) ?? config.taxRates[0];
  return def?.rate ?? 0;
}

/** §E.6 — compute the ADMIN-ONLY margin for a per-visit price. */
function computeMargin(productionHours: number, price: number, config: PricingConfig): MarginResult {
  const { laborCostPerHour, suppliesPerVisit, targetLaborPct, laborBandMin, laborBandMax } = config.margin;
  const estimatedLaborCost = roundToCents(productionHours * laborCostPerHour);
  const totalCost = roundToCents(estimatedLaborCost + suppliesPerVisit);
  const laborPct = price > 0 ? estimatedLaborCost / price : 0;
  const projectedMargin = roundToCents(price - totalCost);
  const marginPct = price > 0 ? projectedMargin / price : 0;
  return {
    laborCostPerHour,
    estimatedLaborCost,
    suppliesPerVisit,
    totalCost,
    laborPct,
    projectedMargin,
    marginPct,
    targetLaborPct,
    laborBandMin,
    laborBandMax,
    outOfBand: laborPct < laborBandMin || laborPct > laborBandMax,
  };
}

// ----------------------------------------------------------------------------
// Core per-visit computation (§E.1 Steps 1–21 for one frequency)
// ----------------------------------------------------------------------------

interface LineContext {
  tier: ResolvedMarketTier;
  seasonalMultiplier: number;
  taxable: boolean;
  taxRate: number;
}

/**
 * Price one visit line for a specific frequency. `frequencyKey` is passed
 * explicitly so the same function can produce the recurring line AND the
 * separate one-time Initial Deep Clean line (§E.2) from one code path.
 */
function computeLine(
  input: ResidentialQuoteInput,
  config: PricingConfig,
  frequencyKey: string,
  ctx: LineContext,
): QuoteLine {
  const frequency = findByKey(config.frequencyMultipliers, frequencyKey, "frequency");

  // Steps 1–6 — labor hours.
  const baseLaborHours = resolveBaseLaborHours(input.sqft, config);
  const bathroomHours =
    Math.max(0, input.bathrooms - config.bathroom.baselineBaths) * config.bathroom.hoursPerExtraBath;
  const bedroomHours = resolveBedroomHours(input.bedrooms, config);
  const petHours = findByKey(config.petAdjustments, input.petKey, "pet option").hours;

  const featureLines: FeatureLine[] = input.featureKeys.map((key) => {
    const feature = findByKey(config.featureOptions, key, "feature");
    return { key: feature.key, label: feature.label, hours: feature.hours };
  });
  const featureHours = featureLines.reduce((sum, f) => sum + f.hours, 0);

  const laborHours = baseLaborHours + bathroomHours + bedroomHours + petHours + featureHours;

  // Steps 7–11 — multipliers → production hours.
  const occupancyMultiplier = findByKey(config.occupancyMultipliers, input.occupancyKey, "occupancy").multiplier;
  const flooringMultiplier = findByKey(config.flooringMultipliers, input.flooringKey, "flooring").multiplier;
  const conditionMultiplier = findByKey(config.conditionMultipliers, input.conditionKey, "condition").multiplier;
  const reconciledIntensity = reconcileIntensity(conditionMultiplier, frequency.isDeepClean, config);
  const productionHours = laborHours * occupancyMultiplier * flooringMultiplier * reconciledIntensity;

  // Steps 12–15 — base price.
  const hourlyRate = ctx.tier.hourlyRate;
  const basePrice = roundToCents(productionHours * hourlyRate * frequency.multiplier * ctx.seasonalMultiplier);

  // Step 16 — travel.
  const travel = resolveTravel(input.travelMiles ?? 0, config);
  const travelFee = roundToCents(travel.fee);

  // Step 17 — add-ons (quantity-aware).
  const addOnLines: AddOnLine[] = [];
  for (const selection of input.addOns) {
    if (selection.quantity <= 0) continue;
    const addOn = findByKey(config.addOns, selection.key, "add-on");
    const quantity = addOn.unit === "PerUnit" ? selection.quantity : 1;
    const lineTotal = roundToCents(addOn.price * quantity);
    addOnLines.push({
      key: addOn.key,
      label: addOn.label,
      unit: addOn.unit,
      quantity,
      unitPrice: addOn.price,
      lineTotal,
    });
  }
  const addOnsTotal = roundToCents(addOnLines.reduce((sum, a) => sum + a.lineTotal, 0));

  // Steps 18–21 — subtotal, minimum, round-up, tax.
  const subtotal = roundToCents(basePrice + travelFee + addOnsTotal);
  const minimumCharge = ctx.tier.minimumCharge;
  const minimumApplied = subtotal < minimumCharge;
  const flooredPrice = Math.max(subtotal, minimumCharge);
  const preTaxPrice = roundUpToIncrement(flooredPrice, config.rounding.increment);

  const taxRate = ctx.taxable ? ctx.taxRate : 0;
  const taxAmount = roundToCents(preTaxPrice * taxRate);
  const total = roundToCents(preTaxPrice + taxAmount);

  return {
    frequencyKey: frequency.key,
    frequencyLabel: frequency.label,
    isOneTime: frequency.isOneTime,
    isDeepClean: frequency.isDeepClean,
    baseLaborHours,
    bathroomHours,
    bedroomHours,
    petHours,
    featureHours,
    featureLines,
    laborHours,
    occupancyMultiplier,
    flooringMultiplier,
    conditionMultiplier,
    deepCleanPremium: frequency.isDeepClean ? config.intensity.deepCleanPremium : null,
    reconciledIntensity,
    productionHours,
    hourlyRate,
    frequencyMultiplier: frequency.multiplier,
    seasonalMultiplier: ctx.seasonalMultiplier,
    basePrice,
    travelMiles: travel.miles,
    travelFee,
    travelManualReview: travel.requiresManualReview,
    addOnLines,
    addOnsTotal,
    subtotal,
    minimumCharge,
    minimumApplied,
    preTaxPrice,
    taxable: ctx.taxable,
    taxRate,
    taxAmount,
    total,
    margin: computeMargin(productionHours, preTaxPrice, config),
  };
}

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------

/** Compute a full residential quote, including the §E.2 two-number recurring output. */
export function computeResidentialQuote(
  input: ResidentialQuoteInput,
  config: PricingConfig,
): ResidentialQuoteResult {
  if (!Number.isFinite(input.sqft) || input.sqft <= 0) {
    throw new PricingError("Square footage must be a positive number.");
  }
  if (input.bedrooms < 0 || input.bathrooms < 0) {
    throw new PricingError("Bedrooms and bathrooms cannot be negative.");
  }

  const tier = resolveMarketTier(input, config);
  const seasonal = resolveSeasonal(input.seasonalOverride, input.quoteDate ?? new Date(), config);

  // Residential taxable flag (§E.5) — residential is non-taxable by default.
  const residentialType = config.serviceTypes.find((s) => s.key === "Residential");
  const taxable = residentialType?.taxable ?? false;
  const ctx: LineContext = {
    tier,
    seasonalMultiplier: seasonal.multiplier,
    taxable,
    taxRate: defaultTaxRate(config),
  };

  const primary = computeLine(input, config, input.frequencyKey, ctx);

  // §E.7 — property type multiplier is captured but NOT applied in v1.
  const propertyTypeMultiplier = input.propertyTypeKey
    ? (config.propertyTypes.find((p) => p.key === input.propertyTypeKey)?.multiplier ?? 1)
    : 1;

  const isRecurring = !primary.isOneTime;
  let initialDeepClean: QuoteLine | null = null;
  let projectedMonthly: number | null = null;
  let visitsPerMonth: number | null = null;

  if (isRecurring) {
    // §E.2 — a separate one-time Initial Deep Clean line, priced with the deep
    // premium, charged once for the first visit (never multiplied onto the
    // recurring line). Uses the OneTimeDeep frequency.
    const deep = config.frequencyMultipliers.find((f) => f.isDeepClean && f.isOneTime);
    if (deep) initialDeepClean = computeLine(input, config, deep.key, ctx);

    const frequency = findByKey(config.frequencyMultipliers, input.frequencyKey, "frequency");
    visitsPerMonth = frequency.visitsPerMonth;
    if (visitsPerMonth != null) {
      // Projected monthly = per-visit price × visits/month (§E.2).
      projectedMonthly = roundToCents(primary.preTaxPrice * visitsPerMonth);
    }
  }

  return {
    marketTier: tier,
    seasonal,
    propertyTypeMultiplier,
    primary,
    isRecurring,
    visitsPerMonth,
    projectedMonthly,
    initialDeepClean,
  };
}

/** §E.8 — manual commercial quote: owner-entered price + line items + tax. No engine. */
export function computeCommercialQuote(
  input: CommercialQuoteInput,
  config: PricingConfig,
): CommercialQuoteResult {
  if (!Number.isFinite(input.basePrice) || input.basePrice < 0) {
    throw new PricingError("Commercial base price must be a non-negative number.");
  }
  const lineItemsTotal = roundToCents(input.lineItems.reduce((sum, li) => sum + li.amount, 0));
  const subtotal = roundToCents(input.basePrice + lineItemsTotal);

  const commercialType = config.serviceTypes.find((s) => s.key === "Commercial");
  const taxable = input.taxableOverride ?? commercialType?.taxable ?? true;
  const taxRate = taxable ? defaultTaxRate(config) : 0;
  const taxAmount = roundToCents(subtotal * taxRate);
  const total = roundToCents(subtotal + taxAmount);

  return {
    basePrice: roundToCents(input.basePrice),
    lineItems: input.lineItems,
    lineItemsTotal,
    subtotal,
    taxable,
    taxRate,
    taxAmount,
    total,
  };
}
