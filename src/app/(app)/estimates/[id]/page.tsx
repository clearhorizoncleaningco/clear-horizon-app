import type { Metadata } from "next";
import Link from "next/link";
import { requireProfile } from "@/lib/auth/dal";
import { getEstimate, readCommercialResult, readResidentialResult } from "@/lib/estimates/service";
import { currency, currency0 } from "@/lib/format";
import { publicEnv } from "@/lib/env";
import { QuoteResults } from "@/components/estimate/quote-results";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { generateProposalAction, pushToGhlAction } from "../actions";

export const metadata: Metadata = { title: "Estimate" };

export default async function EstimateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireProfile();
  if (!profile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Account not provisioned</CardTitle>
          <CardDescription>Ask an admin to run the seed/invite step.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const estimate = await getEstimate(profile.organizationId, id);
  if (!estimate) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Estimate not found</CardTitle>
          <CardDescription>It may have been removed, or belongs to another organization.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/estimates" className={buttonVariants({ variant: "outline" })}>← All estimates</Link>
        </CardContent>
      </Card>
    );
  }

  const isAdmin = profile.role === "Admin";
  const siteUrl = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/estimates" className="text-sm text-muted-foreground hover:text-foreground">← All estimates</Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            {estimate.customer?.name ?? "Estimate"}
          </h1>
          <p className="text-muted-foreground">
            {estimate.summary ?? estimate.category} · saved{" "}
            {estimate.createdAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-primary tabular-nums">{currency0(Number(estimate.headlinePrice))}</div>
          <div className="text-xs text-muted-foreground">
            {estimate.isRecurring && estimate.frequencyLabel ? `per visit · ${estimate.frequencyLabel}` : estimate.category}
          </div>
        </div>
      </div>

      {/* Quote breakdown */}
      {estimate.category === "Residential" ? (
        <QuoteResults result={readResidentialResult(estimate.resultJson)} isAdmin={isAdmin} />
      ) : (
        <CommercialBreakdown estimate={estimate} />
      )}

      {/* Proposals */}
      <ProposalsSection estimate={estimate} siteUrl={siteUrl} />
    </div>
  );
}

function CommercialBreakdown({
  estimate,
}: {
  estimate: NonNullable<Awaited<ReturnType<typeof getEstimate>>>;
}) {
  const result = readCommercialResult(estimate.resultJson);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Commercial quote</CardTitle>
        <CardDescription>{estimate.frequencyLabel ?? "Manual walk-through price"}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1 text-sm">
        <Row label="Quoted price" value={currency(result.basePrice)} />
        {result.lineItems.map((li, i) => (
          <Row key={i} label={li.description} value={currency(li.amount)} indent />
        ))}
        <div className="my-1 border-t border-border" />
        <Row label="Subtotal" value={currency(result.subtotal)} />
        {result.taxable ? <Row label={`Tax (${(result.taxRate * 100).toFixed(2)}%)`} value={currency(result.taxAmount)} /> : null}
        <Row label="Total" value={currency(result.total)} strong />
      </CardContent>
    </Card>
  );
}

async function ProposalsSection({
  estimate,
  siteUrl,
}: {
  estimate: NonNullable<Awaited<ReturnType<typeof getEstimate>>>;
  siteUrl: string;
}) {
  const proposals = estimate.proposals;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Proposals</CardTitle>
          <CardDescription>Branded PDF · e-approval link · one-way GHL handoff</CardDescription>
        </div>
        <form action={generateProposalAction}>
          <input type="hidden" name="estimateId" value={estimate.id} />
          <Button type="submit">{proposals.length === 0 ? "Generate proposal" : "Generate another"}</Button>
        </form>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {proposals.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No proposal yet. Generating one freezes the quote, builds the branded PDF, and creates a
            30-day customer approval link.
          </p>
        ) : (
          proposals.map((p) => {
            const approveUrl = `${siteUrl}/approve/${p.token}`;
            const pdfUrl = `/api/proposals/${p.token}/pdf`;
            const ghlReason = (p.ghlResponse as { reason?: string } | null)?.reason;
            return (
              <div key={p.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Proposal {p.token.slice(0, 8).toUpperCase()}</span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                      {p.status}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Expires {p.expiresAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                </div>

                {p.status === "Approved" && p.signerName ? (
                  <p className="mt-1 text-sm text-green-700 dark:text-green-400">
                    ✓ Approved by {p.signerName}
                    {p.approvedAt ? ` on ${p.approvedAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}` : ""}
                    {p.signerIp ? ` (IP ${p.signerIp})` : ""}
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <a href={pdfUrl} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
                    Download PDF
                  </a>
                  <a href={approveUrl} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
                    Open approval page
                  </a>
                  <form action={pushToGhlAction}>
                    <input type="hidden" name="proposalId" value={p.id} />
                    <input type="hidden" name="estimateId" value={estimate.id} />
                    <Button type="submit" variant="secondary" size="sm">
                      {p.ghlStatus === "NotPushed" ? "Push to GHL" : "Re-run GHL push"}
                    </Button>
                  </form>
                </div>

                <p className="mt-2 break-all text-xs text-muted-foreground">
                  Approval link: <span className="font-mono">{approveUrl}</span>
                </p>

                {p.ghlPayload ? (
                  <details className="mt-3 rounded-md bg-muted/50 p-3 text-xs">
                    <summary className="cursor-pointer font-medium">
                      GoHighLevel push — {p.ghlStatus}
                      {ghlReason ? ` (${ghlReason})` : ""}
                    </summary>
                    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all font-mono text-[11px]">
                      {JSON.stringify(p.ghlPayload, null, 2)}
                    </pre>
                  </details>
                ) : null}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function Row({ label, value, strong, indent }: { label: string; value: string; strong?: boolean; indent?: boolean }) {
  return (
    <div
      className={[
        "flex items-baseline justify-between gap-3",
        strong ? "font-semibold" : "",
        indent ? "pl-4 text-muted-foreground" : "",
      ].join(" ")}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
