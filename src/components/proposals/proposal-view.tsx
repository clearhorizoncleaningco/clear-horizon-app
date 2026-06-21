import Image from "next/image";
import { currency, currency0 } from "@/lib/format";
import logo from "../../../public/brand/01_primary_logo_2.png";
import type { ProposalDocument, ProposalPriceSection } from "@/lib/proposals/types";

/**
 * Customer-facing proposal renderer (HTML twin of the PDF). Consumes a
 * margin-free ProposalDocument, so it cannot show internal economics. Used by the
 * public approval page; mirrors the PDF layout/branding (BUILD_SPEC §C/§G).
 */

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function PriceCard({ section }: { section: ProposalPriceSection }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="font-semibold">{section.title}</h4>
          {section.caption ? <p className="text-xs text-muted-foreground">{section.caption}</p> : null}
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{section.headlineLabel}</div>
          <div className="text-3xl font-bold text-primary tabular-nums">{currency0(section.headline)}</div>
        </div>
      </div>
      <dl className="mt-3 flex flex-col gap-1 text-sm">
        {section.lines.map((l, i) => (
          <div key={i} className="flex items-baseline justify-between gap-3">
            <dt>
              {l.label}
              {l.detail ? <span className="text-muted-foreground"> · {l.detail}</span> : null}
            </dt>
            <dd className="tabular-nums">{currency(l.amount)}</dd>
          </div>
        ))}
        {section.subtotal !== undefined ? (
          <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-border pt-1 text-muted-foreground">
            <dt>Subtotal</dt>
            <dd className="tabular-nums">{currency(section.subtotal)}</dd>
          </div>
        ) : null}
        {section.taxAmount !== undefined ? (
          <div className="flex items-baseline justify-between gap-3 text-muted-foreground">
            <dt>{section.taxLabel ?? "Tax"}</dt>
            <dd className="tabular-nums">{currency(section.taxAmount)}</dd>
          </div>
        ) : null}
        <div className="flex items-baseline justify-between gap-3 font-semibold">
          <dt>Total</dt>
          <dd className="tabular-nums">{currency(section.total)}</dd>
        </div>
      </dl>
      {section.footnote ? <p className="mt-2 text-xs text-muted-foreground">{section.footnote}</p> : null}
    </div>
  );
}

export function ProposalView({ document: doc }: { document: ProposalDocument }) {
  const cust = doc.customer;
  const prov = doc.provider;
  const locality = [cust.city, cust.zip].filter(Boolean).join(", ");

  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <Image src={logo} alt={prov.companyName} className="h-16 w-auto" priority />
        <div className="text-sm text-muted-foreground sm:text-right">
          <div className="font-medium text-foreground">{prov.companyName}</div>
          {prov.phone ? <div>{prov.phone}</div> : null}
          {prov.email ? <div>{prov.email}</div> : null}
          {prov.website ? <div>{prov.website}</div> : null}
        </div>
      </header>

      <div className="border-t-2 border-primary pt-3">
        <h1 className="text-2xl font-bold tracking-tight">{doc.serviceTitle}</h1>
        <div className="mt-1 flex flex-wrap justify-between gap-2 text-sm text-muted-foreground">
          <span>Proposal {doc.reference}</span>
          <span>
            Issued {fmtDate(doc.issuedAt)} · Valid until {fmtDate(doc.expiresAt)}
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg bg-muted/50 p-4">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Prepared for</div>
          <div className="font-semibold">{cust.name}</div>
          {cust.address ? <div className="text-sm">{cust.address}</div> : null}
          {locality ? <div className="text-sm">{locality}</div> : null}
          {cust.email ? <div className="text-sm">{cust.email}</div> : null}
          {cust.phone ? <div className="text-sm">{cust.phone}</div> : null}
        </div>
        <div className="rounded-lg bg-muted/50 p-4">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Service</div>
          <div className="font-semibold">{doc.category} cleaning</div>
          {doc.summary ? <div className="text-sm">{doc.summary}</div> : null}
          {prov.tagline ? <div className="mt-2 text-sm text-muted-foreground">{prov.tagline}</div> : null}
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Your quote</h2>
        {doc.prices.map((p) => (
          <PriceCard key={p.key} section={p} />
        ))}
        {doc.notes ? <p className="text-sm text-muted-foreground">Notes: {doc.notes}</p> : null}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">What&apos;s included</h2>
        {doc.scope.map((list) => (
          <div key={list.key}>
            <h3 className="font-semibold text-primary">{list.title}</h3>
            {list.intro ? <p className="text-sm text-muted-foreground">{list.intro}</p> : null}
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {list.sections.map((s, i) => (
                <div key={i}>
                  <div className="text-sm font-semibold">{s.area}</div>
                  <ul className="ml-4 list-disc text-sm text-muted-foreground">
                    {s.tasks.map((t, j) => (
                      <li key={j}>{t}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Terms &amp; Conditions</h2>
        <div className="flex flex-col gap-3">
          {doc.terms.map((t, i) => (
            <div key={i}>
              <h3 className="text-sm font-semibold">{t.heading}</h3>
              {t.body.map((p, j) => (
                <p key={j} className="text-xs leading-relaxed text-muted-foreground">
                  {p}
                </p>
              ))}
            </div>
          ))}
        </div>
      </section>
    </article>
  );
}
