import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildConfigFromDefaults,
  computeResidentialQuote,
  type ResidentialQuoteInput,
} from "@/lib/pricing";
import { buildResidentialProposalDocument } from "./document";
import { renderProposalPdf } from "./pdf";
import type { ProposalCustomer, ProposalParty } from "./types";

/**
 * Generates a REAL branded PDF (Phase 2 verification, §G checkpoint). Renders the
 * §5 fixture quote to a proposal and writes tmp/sample-proposal.pdf so it can be
 * opened/inspected. Asserts the bytes are a valid PDF. Run on its own with
 * `npm run verify:pdf`.
 */
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
const input: ResidentialQuoteInput = {
  sqft: 2200,
  bedrooms: 3,
  bathrooms: 2.5,
  marketTierKeyOverride: "Naples",
  occupancyKey: "Couple",
  flooringKey: "Tile",
  conditionKey: "Average",
  petKey: "One",
  featureKeys: ["Lanai"],
  frequencyKey: "Biweekly",
  addOns: [{ key: "Oven", quantity: 1 }, { key: "InteriorWindows", quantity: 6 }],
  seasonalOverride: null,
  quoteDate: new Date("2026-06-20T12:00:00.000Z"),
};

describe("branded proposal PDF", () => {
  it("renders a valid, non-trivial PDF and writes tmp/sample-proposal.pdf", async () => {
    const config = buildConfigFromDefaults();
    const result = computeResidentialQuote(input, config);
    const doc = buildResidentialProposalDocument({
      result,
      provider,
      customer,
      reference: "CH-SAMPLE",
      summary: "2,200 sq ft · 3 bd / 2.5 ba · Naples · biweekly",
      issuedAt: new Date("2026-06-20T12:00:00.000Z"),
    });

    const buf = await renderProposalPdf(doc);
    const header = buf.subarray(0, 5).toString("latin1");

    expect(header).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(5000);

    const out = path.join(process.cwd(), "tmp", "sample-proposal.pdf");
    mkdirSync(path.dirname(out), { recursive: true });
    writeFileSync(out, buf);
    console.log(`[verify:pdf] wrote ${out} — ${buf.length} bytes, header "${header}"`);
  }, 30_000);
});
