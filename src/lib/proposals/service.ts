import "server-only";

/**
 * Proposal persistence (Phase 2, BUILD_SPEC §G) — generate a branded proposal
 * from a saved estimate, look it up by public token (PDF + approval), capture
 * e-approval, and run the (stubbed) one-way GHL push.
 *
 * The stored `documentJson` is the margin-free ProposalDocument (built in
 * document.ts), so anything reading a proposal — PDF, approval page, GHL payload
 * — is structurally free of internal economics (CLAUDE.md §3.5).
 */
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import type { GhlPushStatus, Organization, Prisma } from "@/generated/prisma/client";
import type { CommercialQuoteResult, ResidentialQuoteResult } from "@/lib/pricing";
import {
  buildCommercialProposalDocument,
  buildResidentialProposalDocument,
  computeExpiry,
} from "./document";
import type { ProposalCustomer, ProposalDocument, ProposalParty } from "./types";
import {
  buildApprovalRecord,
  evaluateProposal,
  type ApprovalSubmission,
} from "./approval";
import { buildGhlPushPayload } from "@/lib/ghl/payload";
import { pushQuoteToGhl, type GhlPushOutcome } from "@/lib/ghl/client";

const BRAND_TAGLINE = "Clean Spaces. Better Places.";

function dec(d: { toNumber(): number } | null | undefined): number {
  return d ? d.toNumber() : 0;
}

function providerFromOrg(org: Organization): ProposalParty {
  return {
    companyName: org.name,
    tagline: BRAND_TAGLINE,
    email: org.contactEmail ?? undefined,
    phone: org.contactPhone ?? undefined,
    website: org.website ?? undefined,
  };
}

export function readProposalDocument(json: Prisma.JsonValue): ProposalDocument {
  return json as unknown as ProposalDocument;
}

/**
 * Generate (issue) a proposal from a saved estimate. Org-scoped. Sets a 30-day
 * expiration, freezes the margin-free document, and marks the estimate Proposed.
 */
export async function createProposalFromEstimate(
  organizationId: string,
  estimateId: string,
): Promise<{ id: string; token: string }> {
  const estimate = await prisma.estimate.findFirst({
    where: { id: estimateId, organizationId },
    include: { customer: true, organization: true },
  });
  if (!estimate) throw new Error("Estimate not found.");

  const provider = providerFromOrg(estimate.organization);
  const customer: ProposalCustomer = estimate.customer
    ? {
        name: estimate.customer.name,
        email: estimate.customer.email ?? undefined,
        phone: estimate.customer.phone ?? undefined,
        address: estimate.customer.address ?? undefined,
        city: estimate.customer.city ?? undefined,
        zip: estimate.customer.zip ?? undefined,
      }
    : commercialCustomerFallback(estimate.inputJson);

  const token = randomUUID();
  const reference = `CH-${token.slice(0, 8).toUpperCase()}`;
  const issuedAt = new Date();
  const expiresAt = computeExpiry(issuedAt);

  let document: ProposalDocument;
  if (estimate.category === "Residential") {
    const result = estimate.resultJson as unknown as ResidentialQuoteResult;
    document = buildResidentialProposalDocument({
      result,
      provider,
      customer,
      reference,
      summary: estimate.summary ?? undefined,
      issuedAt,
      expiresAt,
    });
  } else {
    const result = estimate.resultJson as unknown as CommercialQuoteResult;
    const input = (estimate.inputJson ?? {}) as { scopeNotes?: string | null };
    document = buildCommercialProposalDocument({
      result,
      provider,
      customer,
      reference,
      frequencyLabel: estimate.frequencyLabel,
      summary: estimate.summary ?? undefined,
      notes: input.scopeNotes ?? undefined,
      issuedAt,
      expiresAt,
    });
  }

  const created = await prisma.$transaction(async (tx) => {
    const proposal = await tx.proposal.create({
      data: {
        organizationId,
        estimateId,
        token,
        status: "Sent",
        documentJson: document as unknown as Prisma.InputJsonValue,
        issuedAt,
        expiresAt,
      },
      select: { id: true, token: true },
    });
    await tx.estimate.update({ where: { id: estimateId }, data: { status: "Proposed" } });
    return proposal;
  });

  return created;
}

function commercialCustomerFallback(json: Prisma.JsonValue): ProposalCustomer {
  const input = (json ?? {}) as { customerName?: string | null };
  return { name: input.customerName?.trim() || "Valued Customer" };
}

/** Public lookup by unguessable token (approval page + PDF route — no auth). */
export async function getProposalByToken(token: string) {
  if (!token) return null;
  return prisma.proposal.findUnique({ where: { token } });
}

/** Internal, org-scoped lookup by id. */
export async function getProposalForOrg(organizationId: string, id: string) {
  return prisma.proposal.findFirst({ where: { id, organizationId }, include: { estimate: true } });
}

export interface ApprovalResult {
  ok: boolean;
  view: "approved" | "expired" | "declined" | "approvable";
  message?: string;
}

/**
 * Record an e-approval (BUILD_SPEC §G: "I agree" + typed name + timestamp + IP).
 * Re-checks the lifecycle so an expired/already-actioned proposal can't be
 * approved. Idempotent-ish: a second approval of an already-approved proposal
 * just reports it as approved.
 */
export async function approveProposalByToken(
  token: string,
  submission: ApprovalSubmission,
  signerIp: string | null,
): Promise<ApprovalResult> {
  const proposal = await getProposalByToken(token);
  if (!proposal) return { ok: false, view: "expired", message: "Proposal not found." };

  const now = new Date();
  const view = evaluateProposal(
    {
      status: proposal.status,
      expiresAt: proposal.expiresAt,
      approvedAt: proposal.approvedAt,
      declinedAt: proposal.declinedAt,
    },
    now,
  );
  if (view !== "approvable") {
    return { ok: false, view, message: viewMessage(view) };
  }

  const record = buildApprovalRecord(submission, signerIp, now);
  await prisma.$transaction(async (tx) => {
    await tx.proposal.update({
      where: { id: proposal.id },
      data: {
        agreed: record.agreed,
        signerName: record.signerName,
        signerIp: record.signerIp,
        approvedAt: record.approvedAt,
        status: "Approved",
      },
    });
    await tx.estimate.update({ where: { id: proposal.estimateId }, data: { status: "Approved" } });
  });

  return { ok: true, view: "approved" };
}

function viewMessage(view: ApprovalResult["view"]): string {
  switch (view) {
    case "approved":
      return "This proposal has already been approved.";
    case "declined":
      return "This proposal was declined.";
    case "expired":
      return "This proposal has expired. Please contact us for an updated quote.";
    default:
      return "";
  }
}

/**
 * One-way push to GoHighLevel (BUILD_SPEC §B) — STUBBED until creds added.
 * Builds the payload, runs the (flag-gated) client, and records the outcome +
 * the would-send payload on the proposal so it can be inspected.
 */
export async function pushProposalToGhl(
  organizationId: string,
  proposalId: string,
): Promise<GhlPushOutcome> {
  const proposal = await prisma.proposal.findFirst({
    where: { id: proposalId, organizationId },
    include: { estimate: true },
  });
  if (!proposal) throw new Error("Proposal not found.");

  const document = readProposalDocument(proposal.documentJson);
  const estimate = proposal.estimate;
  const monetaryValue = estimate.isRecurring
    ? dec(estimate.projectedMonthly) || dec(estimate.headlinePrice)
    : dec(estimate.headlinePrice);

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const payload = buildGhlPushPayload({
    document,
    monetaryValue,
    pdfUrl: `${siteUrl}/api/proposals/${proposal.token}/pdf`,
    approvalUrl: `${siteUrl}/approve/${proposal.token}`,
  });

  const outcome = await pushQuoteToGhl(payload);
  const statusMap: Record<GhlPushOutcome["status"], GhlPushStatus> = {
    stubbed: "Stubbed",
    pushed: "Pushed",
    failed: "Failed",
  };

  await prisma.proposal.update({
    where: { id: proposal.id },
    data: {
      ghlStatus: statusMap[outcome.status],
      ghlPayload: payload as unknown as Prisma.InputJsonValue,
      ghlResponse: outcome as unknown as Prisma.InputJsonValue,
      ghlPushedAt: new Date(),
    },
  });

  return outcome;
}
