import type { Metadata } from "next";
import { evaluateProposal } from "@/lib/proposals/approval";
import { getProposalByToken, readProposalDocument } from "@/lib/proposals/service";
import { ProposalView } from "@/components/proposals/proposal-view";
import { ApprovalForm } from "@/components/proposals/approval-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Review your proposal",
};

export const dynamic = "force-dynamic";

function fmtDateTime(d: Date): string {
  return d.toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" });
}

export default async function ApprovalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const proposal = await getProposalByToken(token);

  if (!proposal) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Proposal not found</CardTitle>
            <CardDescription>
              This link may be incorrect or the proposal may have been removed. Please contact us for
              an updated quote.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const doc = readProposalDocument(proposal.documentJson);
  const view = evaluateProposal(
    {
      status: proposal.status,
      expiresAt: proposal.expiresAt,
      approvedAt: proposal.approvedAt,
      declinedAt: proposal.declinedAt,
    },
    new Date(),
  );

  const pdfHref = `/api/proposals/${proposal.token}/pdf`;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      {view === "approved" ? (
        <Card className="border-green-600/40 bg-green-50 dark:bg-green-950/30">
          <CardHeader>
            <CardTitle className="text-green-700 dark:text-green-400">✓ Proposal approved — thank you!</CardTitle>
            <CardDescription>
              {proposal.signerName ? <>Approved by {proposal.signerName}</> : "Approved"}
              {proposal.approvedAt ? <> on {fmtDateTime(proposal.approvedAt)}</> : null}. A copy is
              available below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a href={pdfHref} className={buttonVariants({ variant: "outline" })} target="_blank" rel="noreferrer">
              Download PDF
            </a>
          </CardContent>
        </Card>
      ) : null}

      {view === "expired" ? (
        <Card className="border-brand-gold/60">
          <CardHeader>
            <CardTitle>This proposal has expired</CardTitle>
            <CardDescription>
              Proposals are valid for 30 days. Please contact {doc.provider.companyName}
              {doc.provider.phone ? <> at {doc.provider.phone}</> : null} for an updated quote.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {view === "declined" ? (
        <Card className="border-brand-gold/60">
          <CardHeader>
            <CardTitle>This proposal was declined</CardTitle>
            <CardDescription>Please contact us if you&apos;d like to revisit it.</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardContent className="pt-6">
          <ProposalView document={doc} />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <a href={pdfHref} className={buttonVariants({ variant: "outline" })} target="_blank" rel="noreferrer">
          Download PDF
        </a>
      </div>

      {view === "approvable" ? <ApprovalForm token={proposal.token} expiresAt={proposal.expiresAt.toISOString()} /> : null}
    </main>
  );
}
