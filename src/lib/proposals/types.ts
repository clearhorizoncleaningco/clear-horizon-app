/**
 * The proposal document model — a PURE, customer-facing projection.
 *
 * CRITICAL (CLAUDE.md §3.5 / §5): this shape has NO margin/labor/cost fields.
 * The builder (document.ts) maps an engine result into this document and simply
 * never copies the admin-only `margin` block across, so a proposal/PDF/approval
 * page literally cannot leak internal economics. Stored verbatim on
 * `Proposal.documentJson` so an issued proposal is immutable.
 *
 * No Prisma, no `server-only`, no React — safe to import anywhere (PDF renderer,
 * server pages, and the public approval page).
 */

export type ProposalCategory = "Residential" | "Commercial";

export interface ProposalParty {
  companyName: string;
  tagline?: string;
  email?: string;
  phone?: string;
  website?: string;
}

export interface ProposalCustomer {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  zip?: string;
}

/** A single customer-friendly money line inside a price section. */
export interface ProposalLineItem {
  label: string;
  detail?: string;
  amount: number; // dollars
}

/** One priced block (e.g. recurring per-visit, the one-time initial deep clean,
 *  or a single commercial service). Money only — never hours/margin. */
export interface ProposalPriceSection {
  key: string;
  title: string;
  caption?: string; // e.g. "Biweekly · Naples"
  headline: number; // headline price (rounded, pre-tax)
  headlineLabel: string; // "Per visit" | "One-time" | "Total"
  lines: ProposalLineItem[];
  subtotal?: number;
  taxLabel?: string;
  taxAmount?: number;
  total: number;
  footnote?: string; // e.g. "Projected monthly: $1,085 (2.17 visits/mo)"
}

export interface ScopeChecklistSection {
  area: string;
  tasks: string[];
}

export interface ScopeChecklist {
  key: string;
  title: string;
  intro?: string;
  sections: ScopeChecklistSection[];
}

export interface TermsSection {
  heading: string;
  body: string[]; // paragraphs
}

/** Everything needed to render a proposal — and nothing that isn't. */
export interface ProposalDocument {
  schemaVersion: 1;
  category: ProposalCategory;
  reference: string; // short human-readable reference
  serviceTitle: string; // "Residential Cleaning Proposal"
  issuedAt: string; // ISO
  expiresAt: string; // ISO (30 days after issue, §G)
  provider: ProposalParty;
  customer: ProposalCustomer;
  summary?: string; // property/service one-liner
  prices: ProposalPriceSection[];
  scope: ScopeChecklist[];
  terms: TermsSection[];
  notes?: string; // scope notes / customer notes (no internal data)
}
