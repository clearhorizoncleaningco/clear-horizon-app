import { describe, expect, it } from "vitest";
import { buildGhlPushPayload, splitName } from "./payload";
import type { ProposalDocument } from "@/lib/proposals/types";

const doc: ProposalDocument = {
  schemaVersion: 1,
  category: "Residential",
  reference: "CH-ABCD",
  serviceTitle: "Residential Cleaning Proposal",
  issuedAt: "2026-06-20T12:00:00.000Z",
  expiresAt: "2026-07-20T12:00:00.000Z",
  provider: { companyName: "Clear Horizon Cleaning Co." },
  customer: {
    name: "Jane Q Doe",
    email: "jane@example.com",
    phone: "(239) 555-0100",
    address: "123 Gulf Shore Blvd",
    city: "Naples",
    zip: "34102",
  },
  prices: [],
  scope: [],
  terms: [],
};

describe("splitName", () => {
  it("splits first / last", () => {
    expect(splitName("Jane Doe")).toEqual({ firstName: "Jane", lastName: "Doe" });
    expect(splitName("Jane Q Doe")).toEqual({ firstName: "Jane", lastName: "Q Doe" });
    expect(splitName("Cher")).toEqual({ firstName: "Cher" });
    expect(splitName("   ")).toEqual({});
  });
});

describe("buildGhlPushPayload", () => {
  const payload = buildGhlPushPayload({
    document: doc,
    monetaryValue: 1085.25,
    pdfUrl: "https://app.example.com/api/proposals/tok/pdf",
    approvalUrl: "https://app.example.com/approve/tok",
  });

  it("maps the customer into a GHL contact", () => {
    expect(payload.contact.name).toBe("Jane Q Doe");
    expect(payload.contact.firstName).toBe("Jane");
    expect(payload.contact.email).toBe("jane@example.com");
    expect(payload.contact.postalCode).toBe("34102");
    expect(payload.contact.tags).toContain("residential");
  });

  it("sets the opportunity value (rounded to cents)", () => {
    expect(payload.opportunity.monetaryValue).toBe(1085.25);
    expect(payload.opportunity.status).toBe("open");
    expect(payload.opportunity.name).toContain("Jane Q Doe");
  });

  it("attaches the proposal links + expiry", () => {
    expect(payload.proposal.reference).toBe("CH-ABCD");
    expect(payload.proposal.pdfUrl).toContain("/pdf");
    expect(payload.proposal.approvalUrl).toContain("/approve/");
    expect(payload.proposal.expiresAt).toBe(doc.expiresAt);
  });
});
