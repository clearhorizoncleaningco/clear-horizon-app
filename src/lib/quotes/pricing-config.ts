import "server-only";

import { prisma } from "@/lib/db";
import { parsePricingSettings, type PricingConfig, type ServiceCategory } from "@/lib/pricing";

/**
 * Loads the org's pricing configuration from the DB and maps it into the pure
 * `PricingConfig` the engine consumes (CLAUDE.md §3.1/§3.2). This is the ONE
 * place Prisma `Decimal` values are converted to plain `number` — the engine
 * itself never sees a Decimal, so it stays pure and unit-testable.
 *
 * Server-only: imports Prisma. Never import from a Client Component — instead a
 * Server Component loads the config and passes the plain object as a prop.
 */

/** decimal.js (Prisma 7 Decimal) → number. */
type DecimalLike = { toNumber(): number };
const toNum = (d: DecimalLike): number => d.toNumber();
const toNumOrNull = (d: DecimalLike | null): number | null => (d === null ? null : d.toNumber());

export async function loadPricingConfig(organizationId: string): Promise<PricingConfig> {
  const where = { organizationId };
  const orderBySort = { sortOrder: "asc" as const };

  const [
    org,
    sqftLaborTiers,
    bedroomAdjustments,
    petAdjustments,
    featureOptions,
    occupancyMultipliers,
    flooringMultipliers,
    conditionMultipliers,
    frequencyMultipliers,
    marketTiers,
    zipTierMappings,
    addOns,
    travelBrackets,
    taxRates,
    serviceTypes,
    propertyTypes,
    pricingSettings,
    marginConfig,
  ] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId } }),
    prisma.sqftLaborTier.findMany({ where, orderBy: orderBySort }),
    prisma.bedroomAdjustment.findMany({ where, orderBy: orderBySort }),
    prisma.petAdjustment.findMany({ where, orderBy: orderBySort }),
    prisma.featureOption.findMany({ where, orderBy: orderBySort }),
    prisma.occupancyMultiplier.findMany({ where, orderBy: orderBySort }),
    prisma.flooringMultiplier.findMany({ where, orderBy: orderBySort }),
    prisma.conditionMultiplier.findMany({ where, orderBy: orderBySort }),
    prisma.frequencyMultiplier.findMany({ where, orderBy: orderBySort }),
    prisma.marketTier.findMany({ where, orderBy: orderBySort }),
    prisma.zipTierMapping.findMany({ where, orderBy: { zip: "asc" } }),
    prisma.addOn.findMany({ where, orderBy: orderBySort }),
    prisma.travelBracket.findMany({ where, orderBy: orderBySort }),
    prisma.taxRate.findMany({ where }),
    prisma.serviceTypeConfig.findMany({ where }),
    prisma.propertyType.findMany({ where, orderBy: orderBySort }),
    prisma.pricingSetting.findMany({ where }),
    prisma.marginConfig.findUnique({ where: { organizationId } }),
  ]);

  if (!org) throw new Error(`Organization ${organizationId} not found.`);
  if (!marginConfig) {
    throw new Error("Margin config missing for this organization. Run `npm run db:seed`.");
  }

  const knobs = parsePricingSettings(
    pricingSettings.map((s) => ({ key: s.key, value: s.value, valueType: s.valueType })),
  );

  return {
    sqftLaborTiers: sqftLaborTiers.map((t) => ({
      minSqft: t.minSqft,
      maxSqft: t.maxSqft,
      baseHours: toNum(t.baseHours),
      thresholdSqft: t.thresholdSqft,
      stepSqft: t.stepSqft,
      stepHours: toNumOrNull(t.stepHours),
    })),
    bathroom: knobs.bathroom,
    bedroomAdjustments: bedroomAdjustments.map((b) => ({
      minBeds: b.minBeds,
      maxBeds: b.maxBeds,
      hours: toNum(b.hours),
    })),
    petAdjustments: petAdjustments.map((p) => ({ key: p.key, label: p.label, hours: toNum(p.hours) })),
    featureOptions: featureOptions.map((f) => ({ key: f.key, label: f.label, hours: toNum(f.hours) })),
    occupancyMultipliers: occupancyMultipliers.map((m) => ({ key: m.key, label: m.label, multiplier: toNum(m.multiplier) })),
    flooringMultipliers: flooringMultipliers.map((m) => ({ key: m.key, label: m.label, multiplier: toNum(m.multiplier) })),
    conditionMultipliers: conditionMultipliers.map((m) => ({ key: m.key, label: m.label, multiplier: toNum(m.multiplier) })),
    frequencyMultipliers: frequencyMultipliers.map((f) => ({
      key: f.key,
      label: f.label,
      multiplier: toNum(f.multiplier),
      visitsPerMonth: toNumOrNull(f.visitsPerMonth),
      isOneTime: f.isOneTime,
      isDeepClean: f.isDeepClean,
    })),
    marketTiers: marketTiers.map((t) => ({
      key: t.key,
      label: t.label,
      hourlyRate: toNum(t.hourlyRate),
      minimumCharge: toNum(t.minimumCharge),
    })),
    zipTierMappings: zipTierMappings.map((z) => ({ zip: z.zip, tierKey: z.tierKey })),
    addOns: addOns.map((a) => ({
      key: a.key,
      label: a.label,
      price: toNum(a.price),
      unit: a.unit,
      category: a.category as ServiceCategory,
    })),
    travelBrackets: travelBrackets.map((t) => ({
      minMiles: t.minMiles,
      maxMiles: t.maxMiles,
      fee: toNum(t.fee),
      requiresManualReview: t.requiresManualReview,
    })),
    taxRates: taxRates.map((t) => ({ jurisdiction: t.jurisdiction, rate: toNum(t.rate), isDefault: t.isDefault })),
    serviceTypes: serviceTypes.map((s) => ({ key: s.key as ServiceCategory, label: s.label, taxable: s.taxable })),
    propertyTypes: propertyTypes.map((p) => ({ key: p.key, label: p.label, multiplier: toNum(p.multiplier) })),
    intensity: knobs.intensity,
    rounding: knobs.rounding,
    seasonal: knobs.seasonal,
    defaultMarketTierKey: org.defaultMarketTierKey ?? marketTiers[0]?.key ?? "Naples",
    margin: {
      laborCostPerHour: toNum(marginConfig.laborCostPerHour),
      suppliesPerVisit: toNum(marginConfig.suppliesPerVisit),
      targetLaborPct: toNum(marginConfig.targetLaborPct),
      laborBandMin: toNum(marginConfig.laborBandMin),
      laborBandMax: toNum(marginConfig.laborBandMax),
    },
  };
}
