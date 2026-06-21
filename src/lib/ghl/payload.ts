/**
 * GoHighLevel push payload builder (BUILD_SPEC §B) — PURE.
 *
 * HANDOFF is one-way: this app PUSHES a finished quote to GHL (create/update
 * contact, attach the proposal, set the opportunity value). This module only
 * SHAPES the payload; the actual send (behind a feature flag, stubbed off) lives
 * in client.ts. We do NOT build CRM/pipeline here — GHL owns that.
 */
import type { ProposalDocument } from "@/lib/proposals/types";

export interface GhlContactPayload {
  name: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address1?: string;
  city?: string;
  postalCode?: string;
  source: string;
  tags: string[];
}

export interface GhlOpportunityPayload {
  name: string;
  monetaryValue: number;
  status: string; // GHL opportunity status, e.g. "open"
}

export interface GhlProposalAttachment {
  reference: string;
  category: string;
  pdfUrl: string;
  approvalUrl: string;
  expiresAt: string;
}

export interface GhlPushPayload {
  contact: GhlContactPayload;
  opportunity: GhlOpportunityPayload;
  proposal: GhlProposalAttachment;
}

/** Split a display name into first / last for GHL's contact fields. */
export function splitName(full: string): { firstName?: string; lastName?: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { firstName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export interface BuildGhlPayloadArgs {
  document: ProposalDocument;
  /** The opportunity value (monthly for recurring, total for one-time). */
  monetaryValue: number;
  pdfUrl: string;
  approvalUrl: string;
  /** GHL opportunity status; defaults to "open". */
  opportunityStatus?: string;
}

export function buildGhlPushPayload(args: BuildGhlPayloadArgs): GhlPushPayload {
  const { document: doc } = args;
  const { firstName, lastName } = splitName(doc.customer.name);

  return {
    contact: {
      name: doc.customer.name,
      firstName,
      lastName,
      email: doc.customer.email || undefined,
      phone: doc.customer.phone || undefined,
      address1: doc.customer.address || undefined,
      city: doc.customer.city || undefined,
      postalCode: doc.customer.zip || undefined,
      source: "Clear Horizon Estimator",
      tags: ["clear-horizon-quote", doc.category.toLowerCase()],
    },
    opportunity: {
      name: `${doc.serviceTitle} — ${doc.customer.name}`,
      monetaryValue: Math.round(args.monetaryValue * 100) / 100,
      status: args.opportunityStatus ?? "open",
    },
    proposal: {
      reference: doc.reference,
      category: doc.category,
      pdfUrl: args.pdfUrl,
      approvalUrl: args.approvalUrl,
      expiresAt: doc.expiresAt,
    },
  };
}
