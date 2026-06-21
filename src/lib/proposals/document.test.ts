import { describe, expect, it } from "vitest";
import {
  buildConfigFromDefaults,
  computeCommercialQuote,
  computeResidentialQuote,
  type PricingConfig,
  type ResidentialQuoteInput,
} from "@/lib/pricing";
import {
  buildCommercialProposalDocument,
  buildResidentialProposalDocument,
  computeExpiry,
  PROPOSAL_VALIDITY_DAYS,
} from "./document";
import type { ProposalCustomer, ProposalParty } from "./types";

const config: PricingConfig = buildConfigFromDefaults();
const ISSUED = new Date("2026-06-20T12:00:00.000Z");

const provider: ProposalParty = {
  companyName: "Clear Horizon Cleaning Co.",
  tagline: "Clean Spaces. Better Places.",
  email: "admin@clearhorizoncleaners.com",
  phone: "(239) 396-5740",
  website: "https://www.clearhorizoncleaners.com",
};
const customer: ProposalCustomer = {
  name: "Jane Doe",
  email: "jane@example.com",
  phone: "(239) 555-0100",
  address: "123 Gulf Shore Blvd",
  city: "Naples",
  zip: "34102",
};

function resInput(overrides: Partial<ResidentialQuoteInput> = {}): ResidentialQuoteInput {
  return {
    sqft: 2200,
    bedrooms: 3,
    bathrooms: 2.5,
    marketTierKeyOverride: "Naples",
    occupancyKey: "Couple",
    flooringKey: "Tile",
    conditionKey: "Average",
    petKey: "One",
    featureKeys: [],
    frequencyKey: "Biweekly",
    addOns: [],
    seasonalOverride: null,
    quoteDate: ISSUED,
    ...overrides,
  };
}

// Keys that exist on the engine result but must NEVER reach a customer-facing
// document (admin-only margin + internal hour/multiplier mechanics, §E.6 / §3.5).
const FORBIDDEN_KEYS = new Set([
  "margin",
  "estimatedLaborCost",
  "laborCostPerHour",
  "suppliesPerVisit",
  "totalCost",
  "laborPct",
  "projectedMargin",
  "marginPct",
  "targetLaborPct",
  "laborBandMin",
  "laborBandMax",
  "outOfBand",
  "productionHours",
  "laborHours",
  "baseLaborHours",
  "hourlyRate",
  "reconciledIntensity",
]);

function collectKeys(obj: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(obj)) {
    obj.forEach((o) => collectKeys(o, keys));
  } else if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      keys.add(k);
      collectKeys(v, keys);
    }
  }
  return keys;
}

describe("residential proposal document", () => {
  const result = computeResidentialQuote(resInput(), config);
  const doc = buildResidentialProposalDocument({ result, provider, customer, reference: "CH-TEST", issuedAt: ISSUED });

  it("has two price sections for a recurring quote (per-visit + initial deep clean)", () => {
    expect(doc.prices.map((p) => p.key)).toEqual(["recurring", "initial-deep-clean"]);
    expect(doc.prices[0].headline).toBe(result.primary.preTaxPrice);
    expect(doc.prices[0].headlineLabel).toBe("Per visit");
    expect(doc.prices[0].footnote).toContain("Projected monthly");
    expect(doc.prices[1].headline).toBe(result.initialDeepClean!.preTaxPrice);
  });

  it("includes standard + deep scope checklists and the full T&C", () => {
    expect(doc.scope.map((s) => s.key)).toEqual(["residential-standard", "residential-deep"]);
    expect(doc.terms.length).toBeGreaterThanOrEqual(10);
  });

  it("sets a 30-day expiration", () => {
    expect(doc.expiresAt).toBe(computeExpiry(ISSUED).toISOString());
    const days = (new Date(doc.expiresAt).getTime() - new Date(doc.issuedAt).getTime()) / 86_400_000;
    expect(days).toBe(PROPOSAL_VALIDITY_DAYS);
  });

  it("MARGIN FIREWALL: the serialized document contains no admin-only keys", () => {
    const stored: unknown = JSON.parse(JSON.stringify(doc));
    const present = collectKeys(stored);
    const leaked = [...FORBIDDEN_KEYS].filter((k) => present.has(k));
    expect(leaked).toEqual([]);
  });

  it("one-time quote yields a single section", () => {
    const oneTime = computeResidentialQuote(resInput({ frequencyKey: "OneTimeDeep" }), config);
    const d = buildResidentialProposalDocument({ result: oneTime, provider, customer, reference: "CH-1T", issuedAt: ISSUED });
    expect(d.prices).toHaveLength(1);
    expect(d.prices[0].headlineLabel).toBe("One-time");
    expect(d.scope.map((s) => s.key)).toEqual(["residential-deep"]);
  });
});

describe("commercial proposal document", () => {
  const result = computeCommercialQuote(
    { basePrice: 1200, lineItems: [{ description: "Strip & wax (quarterly)", amount: 400 }], taxableOverride: true },
    config,
  );
  const doc = buildCommercialProposalDocument({
    result,
    provider,
    customer: { ...customer, name: "Gulfshore Offices LLC" },
    reference: "CH-COMM",
    frequencyLabel: "3× / week",
    issuedAt: ISSUED,
  });

  it("renders one section with line items, tax, and the commercial checklist", () => {
    expect(doc.prices).toHaveLength(1);
    expect(doc.prices[0].total).toBe(result.total);
    expect(doc.prices[0].taxAmount).toBe(result.taxAmount);
    expect(doc.prices[0].lines.some((l) => l.label.includes("Strip & wax"))).toBe(true);
    expect(doc.scope.map((s) => s.key)).toEqual(["commercial-standard"]);
  });

  it("MARGIN FIREWALL: commercial document has no admin-only keys", () => {
    const present = collectKeys(JSON.parse(JSON.stringify(doc)));
    expect([...FORBIDDEN_KEYS].filter((k) => present.has(k))).toEqual([]);
  });
});
