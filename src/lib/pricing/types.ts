/**
 * Pure pricing types — NO Prisma, NO `server-only`, NO React imports.
 *
 * The engine (engine.ts) operates entirely on these plain-number shapes so it
 * is (a) fully unit-testable without a database and (b) safe to import into a
 * Client Component for the wizard's live price, or a future public quote widget.
 *
 * The DB → PricingConfig mapping (which converts Prisma `Decimal` objects to
 * `number`) lives OUTSIDE this module, in src/lib/quotes/pricing-config.ts.
 */

export type AddOnUnit = "Flat" | "PerUnit";
export type ServiceCategory = "Residential" | "Commercial";
export type IntensityRule = "max" | "product";
export type SeasonalOverride = "peak" | "off";
export type MarketTierSource = "zip" | "override" | "default";

// ----------------------------------------------------------------------------
// Config shape (built from §E defaults or from the DB; identical structure)
// ----------------------------------------------------------------------------

export interface SqftLaborTier {
  minSqft: number;
  maxSqft: number | null; // null = open-ended (uses the overflow formula)
  baseHours: number;
  thresholdSqft: number | null; // open-ended tier only
  stepSqft: number | null; // open-ended tier only
  stepHours: number | null; // open-ended tier only
}

export interface BedroomBand {
  minBeds: number;
  maxBeds: number | null;
  hours: number;
}

export interface KeyedHours {
  key: string;
  label: string;
  hours: number;
}

export interface KeyedMultiplier {
  key: string;
  label: string;
  multiplier: number;
}

export interface FrequencyOption {
  key: string;
  label: string;
  multiplier: number;
  visitsPerMonth: number | null; // null for one-time services
  isOneTime: boolean;
  isDeepClean: boolean;
}

export interface MarketTier {
  key: string;
  label: string;
  hourlyRate: number;
  minimumCharge: number;
}

export interface ZipTierMapping {
  zip: string;
  tierKey: string;
}

export interface AddOnOption {
  key: string;
  label: string;
  price: number;
  unit: AddOnUnit;
  category: ServiceCategory;
}

export interface TravelBracket {
  minMiles: number;
  maxMiles: number | null;
  fee: number;
  requiresManualReview: boolean;
}

export interface TaxRate {
  jurisdiction: string;
  rate: number; // e.g. 0.06 = 6%
  isDefault: boolean;
}

export interface ServiceTypeConfig {
  key: ServiceCategory;
  label: string;
  taxable: boolean;
}

export interface PropertyTypeOption {
  key: string;
  label: string;
  multiplier: number; // §E.7 — captured but NOT applied in v1
}

export interface IntensityConfig {
  rule: IntensityRule; // §E.10 default "max"
  cap: number; // §E.10 default 1.75
  deepCleanPremium: number; // §E.10 (provisional default 1.5)
}

export interface RoundingConfig {
  increment: number; // §E.21 round pre-tax UP to next $increment
  mode: "ceil";
}

export interface SeasonalConfig {
  peakMultiplier: number; // §E.14 Nov–Apr
  offMultiplier: number; // §E.14 May–Oct
  peakMonths: number[]; // 1-based month numbers in peak season
}

export interface BathroomConfig {
  baselineBaths: number; // §E.1 Step 2
  hoursPerExtraBath: number;
}

export interface MarginConfig {
  laborCostPerHour: number; // §E.6 blended cost per crew-hour
  suppliesPerVisit: number;
  targetLaborPct: number; // 0.50
  laborBandMin: number; // 0.40
  laborBandMax: number; // 0.60
}

/** The complete, plain-number pricing configuration the engine consumes. */
export interface PricingConfig {
  sqftLaborTiers: SqftLaborTier[];
  bathroom: BathroomConfig;
  bedroomAdjustments: BedroomBand[];
  petAdjustments: KeyedHours[];
  featureOptions: KeyedHours[];
  occupancyMultipliers: KeyedMultiplier[];
  flooringMultipliers: KeyedMultiplier[];
  conditionMultipliers: KeyedMultiplier[];
  frequencyMultipliers: FrequencyOption[];
  marketTiers: MarketTier[];
  zipTierMappings: ZipTierMapping[];
  addOns: AddOnOption[];
  travelBrackets: TravelBracket[];
  taxRates: TaxRate[];
  serviceTypes: ServiceTypeConfig[];
  propertyTypes: PropertyTypeOption[];
  intensity: IntensityConfig;
  rounding: RoundingConfig;
  seasonal: SeasonalConfig;
  defaultMarketTierKey: string;
  margin: MarginConfig;
}

// ----------------------------------------------------------------------------
// Engine input
// ----------------------------------------------------------------------------

export interface AddOnSelection {
  key: string;
  quantity: number;
}

export interface ResidentialQuoteInput {
  sqft: number;
  bedrooms: number;
  bathrooms: number;
  zip?: string | null;
  /** §E.3 manual tier override — wins over ZIP mapping when set. */
  marketTierKeyOverride?: string | null;
  /** §E.7 — captured for the record; has NO pricing effect in v1. */
  propertyTypeKey?: string | null;
  occupancyKey: string;
  flooringKey: string;
  conditionKey: string;
  petKey: string;
  featureKeys: string[];
  frequencyKey: string;
  /** §E.4 — manual miles entry; resolves to a travel bracket. Blank/0 = $0. */
  travelMiles?: number | null;
  addOns: AddOnSelection[];
  /** §E.14 — manual seasonal override; when null, auto-detect by quoteDate. */
  seasonalOverride?: SeasonalOverride | null;
  /** Used for seasonal auto-detect. Defaults to "now" in the service layer. */
  quoteDate?: Date;
}

// ----------------------------------------------------------------------------
// Engine output
// ----------------------------------------------------------------------------

export interface FeatureLine {
  key: string;
  label: string;
  hours: number;
}

export interface AddOnLine {
  key: string;
  label: string;
  unit: AddOnUnit;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

/** §E.6 — ADMIN-ONLY. The app layer must never render this to staff/clients. */
export interface MarginResult {
  laborCostPerHour: number;
  estimatedLaborCost: number;
  suppliesPerVisit: number;
  totalCost: number;
  laborPct: number; // estimatedLaborCost / price
  projectedMargin: number; // price − totalCost
  marginPct: number; // projectedMargin / price
  targetLaborPct: number;
  laborBandMin: number;
  laborBandMax: number;
  outOfBand: boolean; // laborPct outside [laborBandMin, laborBandMax]
}

export interface ResolvedMarketTier {
  key: string;
  label: string;
  hourlyRate: number;
  minimumCharge: number;
  source: MarketTierSource;
}

/** A single fully-priced visit line (the per-visit service, or the deep-clean). */
export interface QuoteLine {
  frequencyKey: string;
  frequencyLabel: string;
  isOneTime: boolean;
  isDeepClean: boolean;

  // Labor hours (§E.1 Steps 1–6)
  baseLaborHours: number;
  bathroomHours: number;
  bedroomHours: number;
  petHours: number;
  featureHours: number;
  featureLines: FeatureLine[];
  laborHours: number;

  // Multipliers → production hours (§E.1 Steps 7–11)
  occupancyMultiplier: number;
  flooringMultiplier: number;
  conditionMultiplier: number;
  deepCleanPremium: number | null; // set only when isDeepClean
  reconciledIntensity: number;
  productionHours: number;

  // Money (§E.1 Steps 12–21)
  hourlyRate: number;
  frequencyMultiplier: number;
  seasonalMultiplier: number;
  basePrice: number;
  travelMiles: number;
  travelFee: number;
  travelManualReview: boolean;
  addOnLines: AddOnLine[];
  addOnsTotal: number;
  subtotal: number;
  minimumCharge: number;
  minimumApplied: boolean;
  preTaxPrice: number; // after minimum + round-up — the headline per-visit price
  taxable: boolean;
  taxRate: number;
  taxAmount: number;
  total: number; // preTaxPrice + taxAmount

  margin: MarginResult; // ADMIN-ONLY
}

export interface ResidentialQuoteResult {
  marketTier: ResolvedMarketTier;
  seasonal: { multiplier: number; isPeak: boolean; source: "auto" | "override" };
  /** §E.7 — captured; NOT applied to price in v1. */
  propertyTypeMultiplier: number;

  /** The primary service line: the recurring per-visit price, or the one-time price. */
  primary: QuoteLine;

  // §E.2 — recurring services output two numbers + a projection:
  isRecurring: boolean;
  visitsPerMonth: number | null;
  projectedMonthly: number | null;
  /** Separate one-time Initial Deep Clean line (recurring services only). */
  initialDeepClean: QuoteLine | null;
}

// ----------------------------------------------------------------------------
// Commercial (manual path — §E.8). No automated engine; owner enters a price.
// ----------------------------------------------------------------------------

export interface CommercialLineItem {
  description: string;
  amount: number;
}

export interface CommercialQuoteInput {
  basePrice: number; // owner's walk-through price
  lineItems: CommercialLineItem[];
  /** Defaults to the Commercial service-type taxable flag (true) when omitted. */
  taxableOverride?: boolean | null;
}

export interface CommercialQuoteResult {
  basePrice: number;
  lineItems: CommercialLineItem[];
  lineItemsTotal: number;
  subtotal: number;
  taxable: boolean;
  taxRate: number;
  taxAmount: number;
  total: number;
}
