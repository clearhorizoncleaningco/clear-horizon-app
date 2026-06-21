/**
 * Terms & Conditions templates (BUILD_SPEC §G) — PURE.
 *
 * Generated as a **two-party Clear Horizon ↔ Customer** agreement. Per §G we
 * deliberately DO NOT include any Jan-Pro / "Service Coordinator" franchise
 * language or the California CPSWPA fee. We KEEP the required Florida terms:
 *   • FL choice-of-law + Collier County / Naples venue
 *   • net payment terms
 *   • late fee
 *   • 3% annual price increase
 *   • observed holidays
 *   • non-solicitation of personnel
 *   • insurance
 *   • limitation of liability (cap)
 *
 * OWNER-CONFIRMED 2026-06-21: the owner confirmed the numeric term values below —
 * Net 15 commercial terms, 1.5%/mo late fee, liability cap = prior 3 months'
 * fees, 24-month non-solicitation (the 3% annual increase is fixed by §G). They
 * still live in one config object so they can be adjusted and a future phase can
 * move them into Admin. These are contract terms, not pricing inputs, so they are
 * not in the DB pricing tables. NOTE: the *values* are owner-confirmed; have
 * counsel review the final prose before relying on it.
 */
import type { ProposalCategory, TermsSection } from "./types";

export interface TermsConfig {
  /** Commercial net payment window, in days. */
  netTermsDays: number;
  /** Finance charge on past-due balances, percent per month. */
  lateFeeMonthlyPct: number;
  /** Annual price increase on recurring agreements (§G specifies 3%). */
  annualIncreasePct: number;
  /** Liability cap basis: fees paid in the preceding N months. */
  liabilityCapMonths: number;
  /** Non-solicitation period after the agreement ends, in months. */
  nonSolicitMonths: number;
  /** Liquidated damages for breach of non-solicitation. */
  nonSolicitLiquidatedDamages: string;
  /** Holidays on which service is not performed (rescheduled). */
  observedHolidays: string[];
  /** Hours of notice required to reschedule/cancel a visit without a fee. */
  cancellationNoticeHours: number;
  /** US state whose law governs + venue county/city. */
  governingState: string;
  venueCounty: string;
  venueCity: string;
}

/** Florida-market term values — OWNER-CONFIRMED 2026-06-21 (prose pending counsel review). */
export const DEFAULT_TERMS_CONFIG: TermsConfig = {
  netTermsDays: 15,
  lateFeeMonthlyPct: 1.5,
  annualIncreasePct: 3,
  liabilityCapMonths: 3,
  nonSolicitMonths: 24,
  nonSolicitLiquidatedDamages: "the greater of $2,500 or twelve (12) times the most recent monthly service charge",
  observedHolidays: [
    "New Year's Day",
    "Memorial Day",
    "Independence Day",
    "Labor Day",
    "Thanksgiving Day",
    "Christmas Day",
  ],
  cancellationNoticeHours: 48,
  governingState: "Florida",
  venueCounty: "Collier County",
  venueCity: "Naples",
};

export interface TermsContext {
  category: ProposalCategory;
  isRecurring: boolean;
  companyName: string;
  config?: TermsConfig;
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/**
 * Build the ordered T&C sections for a proposal. Recurring vs. one-time and
 * residential vs. commercial tailor the payment, renewal, and tax language.
 */
export function buildProposalTerms(ctx: TermsContext): TermsSection[] {
  const cfg = ctx.config ?? DEFAULT_TERMS_CONFIG;
  const co = ctx.companyName;
  const sections: TermsSection[] = [];

  // 1. Parties & acceptance (two-party only — no franchisor/coordinator).
  sections.push({
    heading: "1. Agreement & Acceptance",
    body: [
      `This Cleaning Services Agreement (the "Agreement") is entered into between ${co} ("Company") and the customer identified in this proposal ("Customer"). It governs the cleaning services described in this proposal (the "Services").`,
      `Customer accepts this Agreement by signing electronically, by written acceptance, or by permitting the Company to begin the Services. This proposal is valid until the expiration date shown above.`,
    ],
  });

  // 2. Services & scope.
  sections.push({
    heading: "2. Services & Scope",
    body: [
      `The Company will perform the Services in accordance with the scope-of-work checklist included in this proposal. Tasks outside that checklist (for example, additional rooms, post-construction debris, biohazards, mold, pest remediation, or heavy clutter) are not included and may be quoted separately.`,
      `Customer will provide safe access to the premises, working utilities (water and electricity), and reasonable notice of any hazards, pets, or areas to avoid.`,
    ],
  });

  // 3. Term, renewal & annual increase (§G: 3% annual increase).
  if (ctx.isRecurring) {
    sections.push({
      heading: "3. Term & Renewal",
      body: [
        `Recurring Services continue on the stated frequency until either party cancels with written notice. Either party may terminate this Agreement for any reason on thirty (30) days' written notice.`,
        `Pricing is fixed for the first twelve (12) months of recurring Service. Thereafter, the Company may increase recurring pricing by up to ${cfg.annualIncreasePct}% per year upon thirty (30) days' written notice, to reflect rising labor and supply costs.`,
      ],
    });
  } else {
    sections.push({
      heading: "3. Service Date",
      body: [
        `This proposal covers a one-time Service to be scheduled by mutual agreement. If recurring Service is added later, recurring pricing may increase by up to ${cfg.annualIncreasePct}% per year after the first twelve (12) months upon thirty (30) days' written notice.`,
      ],
    });
  }

  // 4. Payment terms + late fee (residential per-visit vs commercial net terms).
  const paymentBody: string[] =
    ctx.category === "Commercial"
      ? [
          `Invoices are due within ${cfg.netTermsDays} days of the invoice date (Net ${cfg.netTermsDays}). Florida sales tax is added where applicable.`,
          `Past-due balances accrue a finance charge of ${cfg.lateFeeMonthlyPct}% per month (or the maximum permitted by Florida law, if lower). Customer is responsible for reasonable costs of collection, including attorneys' fees.`,
        ]
      : [
          `Payment is due upon completion of each visit unless otherwise agreed in writing. Residential cleaning is generally not subject to Florida sales tax; any applicable taxes or fees are shown on the proposal.`,
          `Past-due balances accrue a finance charge of ${cfg.lateFeeMonthlyPct}% per month (or the maximum permitted by Florida law, if lower). The Company may pause Service on accounts more than ${cfg.netTermsDays} days past due.`,
        ];
  sections.push({ heading: "4. Payment Terms", body: paymentBody });

  // 5. Scheduling, access & holidays.
  sections.push({
    heading: "5. Scheduling, Access & Holidays",
    body: [
      `The Company does not perform Service on the following observed holidays and will reschedule the affected visit: ${joinList(cfg.observedHolidays)}.`,
      `Customer may reschedule or cancel a scheduled visit with at least ${cfg.cancellationNoticeHours} hours' notice. Lockouts or cancellations with less notice may be billed up to the full visit price to cover committed labor.`,
    ],
  });

  // 6. Supplies & equipment.
  sections.push({
    heading: "6. Supplies & Equipment",
    body: [
      `The Company provides all standard cleaning supplies and equipment. If Customer requires specific products (for allergies, sensitive surfaces, or preference), Customer will provide them or request them in advance; specialty products may carry an added charge.`,
    ],
  });

  // 7. Insurance.
  sections.push({
    heading: "7. Insurance",
    body: [
      `The Company maintains commercial general liability insurance and workers' compensation coverage as required by Florida law. A certificate of insurance is available to Customer on request.`,
    ],
  });

  // 8. Limitation of liability (cap) + claims window.
  sections.push({
    heading: "8. Limitation of Liability",
    body: [
      `Customer must report any claim of damage or loss within five (5) business days of the affected visit so the Company has a fair opportunity to investigate and cure.`,
      `To the fullest extent permitted by law, the Company's total liability arising out of or relating to this Agreement is limited to the amount Customer paid the Company for Services in the ${cfg.liabilityCapMonths} months preceding the event giving rise to the claim. The Company is not liable for indirect, incidental, consequential, or punitive damages.`,
    ],
  });

  // 9. Non-solicitation of personnel.
  sections.push({
    heading: "9. Non-Solicitation of Personnel",
    body: [
      `During this Agreement and for ${cfg.nonSolicitMonths} months afterward, Customer will not directly or indirectly solicit, hire, or engage any Company employee or contractor who provided Services to Customer, except through the Company.`,
      `Because the Company's investment in recruiting and training is difficult to measure, breach of this section entitles the Company to liquidated damages equal to ${cfg.nonSolicitLiquidatedDamages}, which the parties agree is a reasonable estimate and not a penalty.`,
    ],
  });

  // 10. Satisfaction / re-clean.
  sections.push({
    heading: "10. Satisfaction Guarantee",
    body: [
      `If Customer is not satisfied with any cleaned area, Customer should notify the Company within 24 hours and the Company will re-clean that area at no additional charge. This re-clean is Customer's exclusive remedy for cleaning-quality concerns.`,
    ],
  });

  // 11. Governing law & venue (§G: FL law, Naples / Collier County venue).
  sections.push({
    heading: "11. Governing Law & Venue",
    body: [
      `This Agreement is governed by the laws of the State of ${cfg.governingState}, without regard to its conflict-of-laws rules. The parties consent to exclusive jurisdiction and venue in the state or federal courts located in ${cfg.venueCounty}, ${cfg.governingState} (${cfg.venueCity}).`,
    ],
  });

  // 12. Entire agreement.
  sections.push({
    heading: "12. Entire Agreement",
    body: [
      `This proposal and these terms are the entire agreement between the parties regarding the Services and supersede any prior discussions. If any provision is held unenforceable, the remaining provisions stay in effect. Changes must be in writing and agreed by both parties.`,
    ],
  });

  return sections;
}
