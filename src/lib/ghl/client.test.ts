import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pushQuoteToGhl } from "./client";
import { buildGhlPushPayload, type GhlPushPayload } from "./payload";
import type { ProposalDocument } from "@/lib/proposals/types";

const doc: ProposalDocument = {
  schemaVersion: 1,
  category: "Residential",
  reference: "CH-DEMO",
  serviceTitle: "Residential Cleaning Proposal",
  issuedAt: "2026-06-20T12:00:00.000Z",
  expiresAt: "2026-07-20T12:00:00.000Z",
  provider: { companyName: "Clear Horizon Cleaning Co." },
  customer: { name: "Jane Doe", email: "jane@example.com", phone: "(239) 555-0100", zip: "34102" },
  prices: [],
  scope: [],
  terms: [],
};

const payload: GhlPushPayload = buildGhlPushPayload({
  document: doc,
  monetaryValue: 1085.25,
  pdfUrl: "https://app.example.com/api/proposals/tok/pdf",
  approvalUrl: "https://app.example.com/approve/tok",
});

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.restoreAllMocks();
});
afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("pushQuoteToGhl — STUBBED until credentials added (BUILD_SPEC §B)", () => {
  it("does NOT call the network and returns the would-send payload when disabled", async () => {
    process.env.GHL_PUSH_ENABLED = "false";
    process.env.GHL_WEBHOOK_URL = "";
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const outcome = await pushQuoteToGhl(payload);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(outcome.status).toBe("stubbed");
    if (outcome.status === "stubbed") {
      expect(outcome.reason).toMatch(/disabled/i);
      expect(outcome.wouldSend).toEqual(payload);
    }
  });

  it("stays stubbed when enabled but no webhook URL is set", async () => {
    process.env.GHL_PUSH_ENABLED = "true";
    process.env.GHL_WEBHOOK_URL = "";
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const outcome = await pushQuoteToGhl(payload);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(outcome.status).toBe("stubbed");
    if (outcome.status === "stubbed") expect(outcome.reason).toMatch(/webhook/i);
  });

  it("POSTs once when fully configured (flag on + valid URL)", async () => {
    process.env.GHL_PUSH_ENABLED = "true";
    process.env.GHL_WEBHOOK_URL = "https://example.com/hook";
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const outcome = await pushQuoteToGhl(payload);

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(outcome.status).toBe("pushed");
  });

  it("EVIDENCE — prints the stubbed payload that WOULD be sent", async () => {
    process.env.GHL_PUSH_ENABLED = "false";
    process.env.GHL_WEBHOOK_URL = "";
    const outcome = await pushQuoteToGhl(payload);
    console.log("[verify:ghl] stubbed GHL push outcome:\n" + JSON.stringify(outcome, null, 2));
    expect(outcome.status).toBe("stubbed");
  });
});
