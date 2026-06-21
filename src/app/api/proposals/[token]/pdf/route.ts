import { getProposalByToken, readProposalDocument } from "@/lib/proposals/service";
import { renderProposalPdf } from "@/lib/proposals/pdf";

/**
 * Public branded-PDF route, keyed by the proposal's unguessable token
 * (BUILD_SPEC §G). No auth: the token is the capability, and the document is
 * margin-free by construction. Node runtime — @react-pdf/renderer needs it.
 * Lives under /api, which the proxy matcher excludes from auth redirects.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const proposal = await getProposalByToken(token);
  if (!proposal) {
    return new Response("Proposal not found.", { status: 404 });
  }

  const document = readProposalDocument(proposal.documentJson);
  const pdf = await renderProposalPdf(document);

  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${document.reference}.pdf"`,
      "cache-control": "private, no-store, max-age=0",
    },
  });
}
