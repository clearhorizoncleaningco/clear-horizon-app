import { describe, expect, it } from "vitest";
import { buildProposalTerms, DEFAULT_TERMS_CONFIG, type TermsContext } from "./terms";

function allText(ctx: TermsContext): string {
  return buildProposalTerms(ctx)
    .flatMap((s) => [s.heading, ...s.body])
    .join("\n")
    .toLowerCase();
}

const residentialRecurring: TermsContext = {
  category: "Residential",
  isRecurring: true,
  companyName: "Clear Horizon Cleaning Co.",
};
const commercial: TermsContext = {
  category: "Commercial",
  isRecurring: true,
  companyName: "Clear Horizon Cleaning Co.",
};

describe("T&C — required Florida clauses are present (BUILD_SPEC §G)", () => {
  it("residential keeps every required clause", () => {
    const text = allText(residentialRecurring);
    expect(text).toContain("governed by the laws of the state of florida");
    expect(text).toContain("collier county"); // Naples venue
    expect(text).toContain("naples");
    expect(text).toContain("3% per year"); // 3% annual increase
    expect(text).toContain("finance charge"); // late fee
    expect(text).toContain("non-solicit"); // non-solicitation
    expect(text).toContain("insurance");
    expect(text).toContain("workers' compensation");
    expect(text).toContain("limitation of liability");
    expect(text).toContain("holiday"); // observed holidays
    // Two-party only — names Company and Customer.
    expect(text).toContain("clear horizon cleaning co.");
  });

  it("commercial uses Net terms + the same governing law", () => {
    const text = allText(commercial);
    expect(text).toContain(`net ${DEFAULT_TERMS_CONFIG.netTermsDays}`);
    expect(text).toContain("collier county");
    expect(text).toContain("3% per year");
  });

  it("includes all observed holidays from config", () => {
    const text = allText(residentialRecurring);
    for (const holiday of DEFAULT_TERMS_CONFIG.observedHolidays) {
      expect(text).toContain(holiday.toLowerCase());
    }
  });
});

describe("T&C — forbidden content is removed (BUILD_SPEC §G)", () => {
  it("contains NO Jan-Pro / Service-Coordinator / franchise / California CPSWPA language", () => {
    for (const ctx of [
      residentialRecurring,
      commercial,
      { ...residentialRecurring, isRecurring: false },
    ] satisfies TermsContext[]) {
      const text = allText(ctx);
      expect(text).not.toContain("jan-pro");
      expect(text).not.toContain("janpro");
      expect(text).not.toContain("service coordinator");
      expect(text).not.toContain("franchis"); // franchise/franchisor/franchisee
      expect(text).not.toContain("california");
      expect(text).not.toContain("cpswpa");
    }
  });
});

describe("T&C — term values are configurable", () => {
  it("honors an overridden annual increase + venue", () => {
    const text = buildProposalTerms({
      ...commercial,
      config: { ...DEFAULT_TERMS_CONFIG, annualIncreasePct: 5, venueCounty: "Lee County", venueCity: "Fort Myers" },
    })
      .flatMap((s) => s.body)
      .join("\n")
      .toLowerCase();
    expect(text).toContain("5% per year");
    expect(text).toContain("lee county");
  });
});
