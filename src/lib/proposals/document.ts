/**
 * Build a customer-facing ProposalDocument from an engine result — PURE.
 *
 * The engine result for residential carries an ADMIN-ONLY `margin` block on each
 * line (BUILD_SPEC §E.6). This builder maps ONLY money/scope fields into the
 * document and never touches `margin`, so the proposal/PDF/approval page cannot
 * leak internal economics (CLAUDE.md §3.5). The margin firewall is enforced by
 * a unit test (document.test.ts) that walks the serialized document.
 */
import type {
  CommercialQuoteResult,
  QuoteLine,
  ResidentialQuoteResult,
} from "@/lib/pricing";
import { buildProposalTerms, type TermsConfig } from "./terms";
import { commercialScopes, residentialScopes } from "./scope";
import type {
  ProposalCustomer,
  ProposalDocument,
  ProposalLineItem,
  ProposalParty,
  ProposalPriceSection,
} from "./types";

/** §G — proposals expire 30 days after they are issued. */
export const PROPOSAL_VALIDITY_DAYS = 30;

export function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

/** The 30-day expiration timestamp for a proposal issued at `issuedAt`. */
export function computeExpiry(issuedAt: Date, days: number = PROPOSAL_VALIDITY_DAYS): Date {
  return addDays(issuedAt, days);
}

/** Customer-friendly money lines for one priced visit (NO hours/margin). */
function priceLines(line: QuoteLine): ProposalLineItem[] {
  const items: ProposalLineItem[] = [
    { label: line.isDeepClean ? "Deep cleaning service" : "Cleaning service", amount: line.basePrice },
  ];
  if (line.travelFee > 0) {
    items.push({ label: "Travel", detail: `${line.travelMiles} mi`, amount: line.travelFee });
  }
  for (const a of line.addOnLines) {
    items.push({
      label: a.label,
      detail: a.unit === "PerUnit" ? `×${a.quantity}` : undefined,
      amount: a.lineTotal,
    });
  }
  return items;
}

function lineToSection(
  line: QuoteLine,
  opts: { key: string; title: string; caption?: string; headlineLabel: string; footnote?: string },
): ProposalPriceSection {
  const taxable = line.taxable && line.taxAmount > 0;
  let footnote = opts.footnote;
  if (line.minimumApplied) {
    const note = "Reflects the market minimum service charge.";
    footnote = footnote ? `${footnote} ${note}` : note;
  }
  return {
    key: opts.key,
    title: opts.title,
    caption: opts.caption,
    headline: line.preTaxPrice,
    headlineLabel: opts.headlineLabel,
    lines: priceLines(line),
    subtotal: line.subtotal,
    taxLabel: taxable ? `Tax (${(line.taxRate * 100).toFixed(2)}%)` : undefined,
    taxAmount: taxable ? line.taxAmount : undefined,
    total: line.total,
    footnote,
  };
}

export interface ResidentialDocArgs {
  result: ResidentialQuoteResult;
  provider: ProposalParty;
  customer: ProposalCustomer;
  reference: string;
  serviceTitle?: string;
  summary?: string;
  notes?: string;
  issuedAt: Date;
  expiresAt?: Date;
  termsConfig?: TermsConfig;
}

export function buildResidentialProposalDocument(args: ResidentialDocArgs): ProposalDocument {
  const { result } = args;
  const issuedAt = args.issuedAt;
  const expiresAt = args.expiresAt ?? computeExpiry(issuedAt);

  const prices: ProposalPriceSection[] = [];
  const primaryFreq = result.primary.frequencyLabel;
  const tierLabel = result.marketTier.label;

  if (result.isRecurring) {
    const monthlyNote =
      result.projectedMonthly !== null && result.visitsPerMonth !== null
        ? `Projected monthly: $${result.projectedMonthly.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${result.visitsPerMonth} visits/mo).`
        : undefined;
    prices.push(
      lineToSection(result.primary, {
        key: "recurring",
        title: "Recurring Cleaning",
        caption: `${primaryFreq} · ${tierLabel}`,
        headlineLabel: "Per visit",
        footnote: monthlyNote,
      }),
    );
    if (result.initialDeepClean) {
      prices.push(
        lineToSection(result.initialDeepClean, {
          key: "initial-deep-clean",
          title: "Initial Deep Clean",
          caption: "One-time · before recurring service begins",
          headlineLabel: "One-time",
          footnote: "Charged once for the first visit.",
        }),
      );
    }
  } else {
    prices.push(
      lineToSection(result.primary, {
        key: "one-time",
        title: result.primary.isDeepClean ? "One-Time Deep Clean" : "One-Time Cleaning",
        caption: `${primaryFreq} · ${tierLabel}`,
        headlineLabel: "One-time",
      }),
    );
  }

  return {
    schemaVersion: 1,
    category: "Residential",
    reference: args.reference,
    serviceTitle: args.serviceTitle ?? "Residential Cleaning Proposal",
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    provider: args.provider,
    customer: args.customer,
    summary: args.summary,
    prices,
    scope: residentialScopes({
      isRecurring: result.isRecurring,
      primaryIsDeepClean: result.primary.isDeepClean,
      hasInitialDeepClean: result.initialDeepClean !== null,
    }),
    terms: buildProposalTerms({
      category: "Residential",
      isRecurring: result.isRecurring,
      companyName: args.provider.companyName,
      config: args.termsConfig,
    }),
    notes: args.notes,
  };
}

export interface CommercialDocArgs {
  result: CommercialQuoteResult;
  provider: ProposalParty;
  customer: ProposalCustomer;
  reference: string;
  frequencyLabel?: string | null;
  serviceTitle?: string;
  summary?: string;
  notes?: string;
  issuedAt: Date;
  expiresAt?: Date;
  termsConfig?: TermsConfig;
  /** Commercial recurring vs one-time is owner-described; defaults to recurring. */
  isRecurring?: boolean;
}

export function buildCommercialProposalDocument(args: CommercialDocArgs): ProposalDocument {
  const { result } = args;
  const issuedAt = args.issuedAt;
  const expiresAt = args.expiresAt ?? computeExpiry(issuedAt);
  const isRecurring = args.isRecurring ?? true;

  const lines: ProposalLineItem[] = [{ label: "Cleaning service", amount: result.basePrice }];
  for (const li of result.lineItems) {
    lines.push({ label: li.description, amount: li.amount });
  }
  const taxable = result.taxable && result.taxAmount > 0;

  const section: ProposalPriceSection = {
    key: "commercial",
    title: "Commercial Cleaning",
    caption: args.frequencyLabel ?? undefined,
    headline: result.total,
    headlineLabel: "Total",
    lines,
    subtotal: result.subtotal,
    taxLabel: taxable ? `Tax (${(result.taxRate * 100).toFixed(2)}%)` : undefined,
    taxAmount: taxable ? result.taxAmount : undefined,
    total: result.total,
    footnote: args.frequencyLabel ? `Service schedule: ${args.frequencyLabel}.` : undefined,
  };

  return {
    schemaVersion: 1,
    category: "Commercial",
    reference: args.reference,
    serviceTitle: args.serviceTitle ?? "Commercial Cleaning Proposal",
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    provider: args.provider,
    customer: args.customer,
    summary: args.summary,
    prices: [section],
    scope: commercialScopes(),
    terms: buildProposalTerms({
      category: "Commercial",
      isRecurring,
      companyName: args.provider.companyName,
      config: args.termsConfig,
    }),
    notes: args.notes,
  };
}
