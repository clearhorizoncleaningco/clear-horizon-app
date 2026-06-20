/**
 * Builds a PricingConfig from the §E seed defaults (src/lib/pricing/defaults.ts).
 *
 * This is the PURE config used by the engine unit tests, and also serves as a
 * safe in-memory fallback. The live app builds the same shape from the DB
 * (src/lib/quotes/pricing-config.ts) so Admin edits take effect — both paths
 * share parsePricingSettings() so scalar knobs parse identically.
 */
import * as D from "./defaults";
import { parsePricingSettings } from "./settings";
import type { PricingConfig } from "./types";

export function buildConfigFromDefaults(): PricingConfig {
  const knobs = parsePricingSettings(D.PRICING_SETTINGS);

  return {
    sqftLaborTiers: D.SQFT_LABOR_TIERS.map((t) => ({
      minSqft: t.minSqft,
      maxSqft: t.maxSqft,
      baseHours: t.baseHours,
      thresholdSqft: t.thresholdSqft ?? null,
      stepSqft: t.stepSqft ?? null,
      stepHours: t.stepHours ?? null,
    })),
    bathroom: knobs.bathroom,
    bedroomAdjustments: D.BEDROOM_ADJUSTMENTS.map((b) => ({
      minBeds: b.minBeds,
      maxBeds: b.maxBeds,
      hours: b.hours,
    })),
    petAdjustments: D.PET_ADJUSTMENTS.map((p) => ({ key: p.key, label: p.label, hours: p.hours })),
    featureOptions: D.FEATURE_OPTIONS.map((f) => ({ key: f.key, label: f.label, hours: f.hours })),
    occupancyMultipliers: D.OCCUPANCY_MULTIPLIERS.map((m) => ({ key: m.key, label: m.label, multiplier: m.multiplier })),
    flooringMultipliers: D.FLOORING_MULTIPLIERS.map((m) => ({ key: m.key, label: m.label, multiplier: m.multiplier })),
    conditionMultipliers: D.CONDITION_MULTIPLIERS.map((m) => ({ key: m.key, label: m.label, multiplier: m.multiplier })),
    frequencyMultipliers: D.FREQUENCY_MULTIPLIERS.map((f) => ({
      key: f.key,
      label: f.label,
      multiplier: f.multiplier,
      visitsPerMonth: f.visitsPerMonth,
      isOneTime: f.isOneTime,
      isDeepClean: f.isDeepClean,
    })),
    marketTiers: D.MARKET_TIERS.map((t) => ({
      key: t.key,
      label: t.label,
      hourlyRate: t.hourlyRate,
      minimumCharge: t.minimumCharge,
    })),
    zipTierMappings: D.ZIP_TIER_MAPPINGS.map((z) => ({ zip: z.zip, tierKey: z.tierKey })),
    addOns: D.ADD_ONS.map((a) => ({ key: a.key, label: a.label, price: a.price, unit: a.unit, category: a.category })),
    travelBrackets: D.TRAVEL_BRACKETS.map((t) => ({
      minMiles: t.minMiles,
      maxMiles: t.maxMiles,
      fee: t.fee,
      requiresManualReview: t.requiresManualReview,
    })),
    taxRates: D.TAX_RATES.map((t) => ({ jurisdiction: t.jurisdiction, rate: t.rate, isDefault: t.isDefault })),
    serviceTypes: D.SERVICE_TYPES.map((s) => ({ key: s.key, label: s.label, taxable: s.taxable })),
    propertyTypes: D.PROPERTY_TYPES.map((p) => ({ key: p.key, label: p.label, multiplier: p.multiplier })),
    intensity: knobs.intensity,
    rounding: knobs.rounding,
    seasonal: knobs.seasonal,
    defaultMarketTierKey: D.DEFAULT_MARKET_TIER_KEY,
    margin: { ...D.MARGIN_CONFIG },
  };
}
