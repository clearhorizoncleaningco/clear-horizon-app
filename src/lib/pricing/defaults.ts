/**
 * Calibrated pricing defaults — the single source of truth for seeding.
 *
 * Every value here comes from BUILD_SPEC.md §E. The seed script
 * (prisma/seed.ts) writes these into the database; the engine (Phase 1) reads
 * them back from the DB. Nothing in pricing logic may hardcode these numbers
 * (CLAUDE.md §3.1) — they live here once, are unit-tested against §E
 * (defaults.test.ts), and are Admin-editable after seeding.
 *
 * NOTE ON PROVISIONAL VALUES: §E pins only the Naples hourly rate (derivable as
 * $85/hr from the regression fixture in CLAUDE.md §5). Values marked
 * `isProvisional` / flagged below are sensible starting points NOT given by the
 * spec; the owners must confirm them in Admin. They are called out in the
 * Phase 0 report.
 */

export type AddOnUnit = "Flat" | "PerUnit";
export type ServiceCategory = "Residential" | "Commercial";

export interface SqftLaborTierDefault {
  minSqft: number;
  maxSqft: number | null; // null = open-ended
  baseHours: number;
  thresholdSqft?: number; // open-ended tier only
  stepSqft?: number; // open-ended tier only
  stepHours?: number; // open-ended tier only
}

export interface BandHoursDefault {
  minBeds: number;
  maxBeds: number | null;
  hours: number;
}

export interface KeyedHoursDefault {
  key: string;
  label: string;
  hours: number;
}

export interface KeyedMultiplierDefault {
  key: string;
  label: string;
  multiplier: number;
}

export interface FrequencyDefault {
  key: string;
  label: string;
  multiplier: number;
  visitsPerMonth: number | null;
  isOneTime: boolean;
  isDeepClean: boolean;
}

export interface MarketTierDefault {
  key: string;
  label: string;
  hourlyRate: number;
  minimumCharge: number;
  isProvisional: boolean;
}

export interface AddOnDefault {
  key: string;
  label: string;
  price: number;
  unit: AddOnUnit;
  category: ServiceCategory;
}

export interface TravelBracketDefault {
  minMiles: number;
  maxMiles: number | null;
  fee: number;
  requiresManualReview: boolean;
}

export interface TaxRateDefault {
  jurisdiction: string;
  rate: number;
  isDefault: boolean;
  isProvisional: boolean;
}

export interface ServiceTypeDefault {
  key: ServiceCategory;
  label: string;
  taxable: boolean;
}

export interface PropertyTypeDefault {
  key: string;
  label: string;
  multiplier: number;
}

export interface PricingSettingDefault {
  key: string;
  value: string;
  valueType: "number" | "string" | "boolean" | "json";
  description: string;
}

export interface MarginConfigDefault {
  laborCostPerHour: number;
  suppliesPerVisit: number;
  targetLaborPct: number;
  laborBandMin: number;
  laborBandMax: number;
}

export interface ZipTierMappingDefault {
  zip: string;
  tierKey: string;
  isProvisional: boolean;
}

// §E.1 Step 1 — base labor hours by square footage.
export const SQFT_LABOR_TIERS: SqftLaborTierDefault[] = [
  { minSqft: 0, maxSqft: 1000, baseHours: 2.5 },
  { minSqft: 1001, maxSqft: 1500, baseHours: 3.25 },
  { minSqft: 1501, maxSqft: 2000, baseHours: 4.0 },
  { minSqft: 2001, maxSqft: 2500, baseHours: 5.0 },
  { minSqft: 2501, maxSqft: 3000, baseHours: 6.0 },
  { minSqft: 3001, maxSqft: 4000, baseHours: 7.5 },
  { minSqft: 4001, maxSqft: 5000, baseHours: 9.0 },
  // > 5000: 9.0 + ((sqft - 5000) / 500 * 1.25)
  {
    minSqft: 5001,
    maxSqft: null,
    baseHours: 9.0,
    thresholdSqft: 5000,
    stepSqft: 500,
    stepHours: 1.25,
  },
];

// §E.1 Step 2 — Bathrooms: max(0, baths - baselineBaths) * hoursPerExtraBath.
export const BATHROOM_BASELINE_BATHS = 2;
export const BATHROOM_HOURS_PER_EXTRA_BATH = 0.25;

// §E.1 Step 3 — Bedrooms: 1-3 -> 0, 4 -> 0.25, 5 -> 0.50, 6+ -> 1.00.
export const BEDROOM_ADJUSTMENTS: BandHoursDefault[] = [
  { minBeds: 1, maxBeds: 3, hours: 0 },
  { minBeds: 4, maxBeds: 4, hours: 0.25 },
  { minBeds: 5, maxBeds: 5, hours: 0.5 },
  { minBeds: 6, maxBeds: null, hours: 1.0 },
];

// §E.1 Step 4 — Pets.
export const PET_ADJUSTMENTS: KeyedHoursDefault[] = [
  { key: "None", label: "None", hours: 0 },
  { key: "One", label: "1 pet", hours: 0.5 },
  { key: "TwoPlus", label: "2+ pets", hours: 1.0 },
  { key: "HeavyShedding", label: "Heavy shedding", hours: 1.5 },
];

// §E.1 Step 5 — Features (summed).
export const FEATURE_OPTIONS: KeyedHoursDefault[] = [
  { key: "Stairs", label: "Stairs", hours: 0.5 },
  { key: "Elevator", label: "Elevator", hours: 0.1 },
  { key: "HomeOffice", label: "Home office", hours: 0.25 },
  { key: "Gym", label: "Gym", hours: 0.25 },
  { key: "Theater", label: "Theater", hours: 0.25 },
  { key: "Lanai", label: "Lanai", hours: 0.5 },
  { key: "PoolBath", label: "Pool bath", hours: 0.25 },
];

// §E.1 Step 7 — Occupancy multiplier.
export const OCCUPANCY_MULTIPLIERS: KeyedMultiplierDefault[] = [
  { key: "SeasonalEmpty", label: "Seasonal / Empty", multiplier: 0.9 },
  { key: "Couple", label: "Couple", multiplier: 1.0 },
  { key: "Family", label: "Family", multiplier: 1.1 },
  { key: "LargeFamily", label: "Large family", multiplier: 1.2 },
  { key: "VacationRental", label: "Vacation rental", multiplier: 1.15 },
];

// §E.1 Step 8 — Flooring multiplier.
export const FLOORING_MULTIPLIERS: KeyedMultiplierDefault[] = [
  { key: "Tile", label: "Tile", multiplier: 1.0 },
  { key: "Hardwood", label: "Hardwood", multiplier: 1.05 },
  { key: "Carpet", label: "Carpet", multiplier: 1.1 },
  { key: "LuxuryMixed", label: "Luxury mixed", multiplier: 1.15 },
];

// §E.1 Step 9 — Condition multiplier.
export const CONDITION_MULTIPLIERS: KeyedMultiplierDefault[] = [
  { key: "Excellent", label: "Excellent", multiplier: 0.9 },
  { key: "Average", label: "Average", multiplier: 1.0 },
  { key: "Dirty", label: "Dirty", multiplier: 1.2 },
  { key: "VeryDirty", label: "Very dirty", multiplier: 1.5 },
];

// §E.1 Step 13 — Frequency multiplier + §E.2 visits/month.
export const FREQUENCY_MULTIPLIERS: FrequencyDefault[] = [
  { key: "Weekly", label: "Weekly", multiplier: 0.9, visitsPerMonth: 4.33, isOneTime: false, isDeepClean: false },
  { key: "Biweekly", label: "Biweekly", multiplier: 1.0, visitsPerMonth: 2.17, isOneTime: false, isDeepClean: false },
  { key: "Monthly", label: "Monthly", multiplier: 1.2, visitsPerMonth: 1.0, isOneTime: false, isDeepClean: false },
  { key: "OneTimeStandard", label: "One-time (standard)", multiplier: 1.35, visitsPerMonth: null, isOneTime: true, isDeepClean: false },
  { key: "OneTimeDeep", label: "One-time deep clean", multiplier: 1.75, visitsPerMonth: null, isOneTime: true, isDeepClean: true },
];

// §E.3 + §E.19 — Market tiers (hourly rate + minimum charge).
// Naples $85/hr is LOCKED by the CLAUDE.md §5 fixture (5.625 prod-hrs * $85 = $478.13).
// Fort Myers ($70) and Luxury Naples ($110) hourly rates were owner-confirmed 2026-06-20
// (§E gave only their minimums); all three tier rates are now confirmed.
export const NAPLES_HOURLY_RATE = 85.0;
export const MARKET_TIERS: MarketTierDefault[] = [
  { key: "FortMyers", label: "Fort Myers", hourlyRate: 70.0, minimumCharge: 175.0, isProvisional: false },
  { key: "Naples", label: "Naples", hourlyRate: NAPLES_HOURLY_RATE, minimumCharge: 225.0, isProvisional: false },
  { key: "LuxuryNaples", label: "Luxury Naples", hourlyRate: 110.0, minimumCharge: 300.0, isProvisional: false },
];

// §E.3 — Illustrative starter ZIP -> tier mapping (PROVISIONAL; owners refine).
// SWFL service area: Naples, Fort Myers, Bonita Springs, Estero, Marco Island.
export const ZIP_TIER_MAPPINGS: ZipTierMappingDefault[] = [
  // Luxury Naples (beach / downtown / Park Shore / Pelican Bay)
  { zip: "34102", tierKey: "LuxuryNaples", isProvisional: true },
  { zip: "34103", tierKey: "LuxuryNaples", isProvisional: true },
  { zip: "34108", tierKey: "LuxuryNaples", isProvisional: true },
  // Naples (greater Naples / Marco Island)
  { zip: "34104", tierKey: "Naples", isProvisional: true },
  { zip: "34105", tierKey: "Naples", isProvisional: true },
  { zip: "34109", tierKey: "Naples", isProvisional: true },
  { zip: "34110", tierKey: "Naples", isProvisional: true },
  { zip: "34112", tierKey: "Naples", isProvisional: true },
  { zip: "34145", tierKey: "Naples", isProvisional: true }, // Marco Island
  // Fort Myers / Bonita Springs / Estero
  { zip: "33901", tierKey: "FortMyers", isProvisional: true },
  { zip: "33907", tierKey: "FortMyers", isProvisional: true },
  { zip: "33908", tierKey: "FortMyers", isProvisional: true },
  { zip: "33912", tierKey: "FortMyers", isProvisional: true },
  { zip: "34134", tierKey: "FortMyers", isProvisional: true }, // Bonita Springs
  { zip: "34135", tierKey: "FortMyers", isProvisional: true }, // Bonita Springs
  { zip: "33928", tierKey: "FortMyers", isProvisional: true }, // Estero
  { zip: "33967", tierKey: "FortMyers", isProvisional: true }, // Estero
];
export const DEFAULT_MARKET_TIER_KEY = "Naples"; // §E.3 default when ZIP unmapped

// §E.1 Step 17 — Add-ons (quantity-aware).
export const ADD_ONS: AddOnDefault[] = [
  { key: "Oven", label: "Oven", price: 50, unit: "Flat", category: "Residential" },
  { key: "Refrigerator", label: "Refrigerator", price: 50, unit: "Flat", category: "Residential" },
  { key: "InteriorWindows", label: "Interior windows", price: 8, unit: "PerUnit", category: "Residential" },
  { key: "Baseboards", label: "Baseboards", price: 75, unit: "Flat", category: "Residential" },
  { key: "CeilingFans", label: "Ceiling fans", price: 5, unit: "PerUnit", category: "Residential" },
  { key: "InsideCabinets", label: "Inside cabinets", price: 100, unit: "Flat", category: "Residential" },
  { key: "Laundry", label: "Laundry", price: 50, unit: "Flat", category: "Residential" },
  { key: "Linens", label: "Linens", price: 25, unit: "Flat", category: "Residential" },
];

// §E.1 Step 16 — Travel fee brackets. 30+ mi flags manual review.
export const TRAVEL_BRACKETS: TravelBracketDefault[] = [
  { minMiles: 0, maxMiles: 10, fee: 0, requiresManualReview: false },
  { minMiles: 10, maxMiles: 20, fee: 25, requiresManualReview: false },
  { minMiles: 20, maxMiles: 30, fee: 50, requiresManualReview: false },
  { minMiles: 30, maxMiles: null, fee: 0, requiresManualReview: true },
];

// §E.5 — Tax rates. Residential is non-taxable in FL (see SERVICE_TYPES);
// the FL state base rate (6%) is seeded as a PROVISIONAL default for commercial;
// owners refine per county surtax in Admin.
export const TAX_RATES: TaxRateDefault[] = [
  { jurisdiction: "Florida (state base)", rate: 0.06, isDefault: true, isProvisional: true },
];

// §E.5 — Per service-type taxable flags.
export const SERVICE_TYPES: ServiceTypeDefault[] = [
  { key: "Residential", label: "Residential", taxable: false },
  { key: "Commercial", label: "Commercial", taxable: true },
];

// §E.7 — Property types (multiplier defaulted to 1.0; no pricing effect yet).
export const PROPERTY_TYPES: PropertyTypeDefault[] = [
  { key: "SingleFamily", label: "Single-family home", multiplier: 1.0 },
  { key: "Condo", label: "Condo", multiplier: 1.0 },
  { key: "Townhouse", label: "Townhouse", multiplier: 1.0 },
  { key: "Apartment", label: "Apartment", multiplier: 1.0 },
  { key: "Other", label: "Other", multiplier: 1.0 },
];

// Scalar knobs — §E.1 Step 2 (bathrooms), §E.10 (intensity), §E.14 (seasonal), §E.21 (rounding).
// `intensity.deepCleanPremium` is PROVISIONAL (a default value, not pinned by §E).
export const PRICING_SETTINGS: PricingSettingDefault[] = [
  { key: "bathroom.baselineBaths", value: String(BATHROOM_BASELINE_BATHS), valueType: "number", description: "§E.1 Step 2 — baths above this count add hours" },
  { key: "bathroom.hoursPerExtraBath", value: String(BATHROOM_HOURS_PER_EXTRA_BATH), valueType: "number", description: "§E.1 Step 2 — hours per bath above baseline" },
  { key: "intensity.rule", value: "max", valueType: "string", description: "§E.10 — 'max' | 'product' for deep-clean vs condition reconciliation" },
  { key: "intensity.cap", value: "1.75", valueType: "number", description: "§E.10 — cap on reconciled intensity multiplier" },
  { key: "intensity.deepCleanPremium", value: "1.5", valueType: "number", description: "§E.10 — deep-clean intensity premium (PROVISIONAL — confirm)" },
  { key: "rounding.increment", value: "25", valueType: "number", description: "§E.21 — round pre-tax price up to next $ increment" },
  { key: "rounding.mode", value: "ceil", valueType: "string", description: "§E.21 — always round UP (CEILING)" },
  { key: "seasonal.peakMultiplier", value: "1.10", valueType: "number", description: "§E.14 — Nov-Apr multiplier" },
  { key: "seasonal.offMultiplier", value: "1.00", valueType: "number", description: "§E.14 — May-Oct multiplier" },
  { key: "seasonal.peakMonths", value: "[11,12,1,2,3,4]", valueType: "json", description: "§E.14 — peak season months (Nov-Apr)" },
];

// §E.6 — Internal margin (ADMIN-ONLY).
export const MARGIN_CONFIG: MarginConfigDefault = {
  laborCostPerHour: 22.0,
  suppliesPerVisit: 10.0,
  targetLaborPct: 0.5,
  laborBandMin: 0.4,
  laborBandMax: 0.6,
};
