import type { Metadata } from "next";
import { getJobByReportToken } from "@/lib/jobs/service";
import { buildPhotoReport } from "@/lib/jobs/report";
import { publicPhotoUrl } from "@/lib/jobs/storage";
import { PhotoReportView } from "@/components/jobs/photo-report-view";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Your clean — before & after" };
export const dynamic = "force-dynamic";

const BRAND_TAGLINE = "Clean Spaces. Better Places.";

export default async function ReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const job = await getJobByReportToken(token);

  if (!job || !job.reportPublished) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Report not available</CardTitle>
            <CardDescription>
              This link may be incorrect or the report hasn&apos;t been published yet. Please contact us if you
              were expecting it.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const doc = buildPhotoReport({
    reference: `CH-JOB-${token.slice(0, 8).toUpperCase()}`,
    customerName: job.customerName,
    summary: job.summary,
    completedAt: job.completedAt,
    address: job.address,
    city: job.city,
    provider: {
      companyName: job.organization.name,
      tagline: BRAND_TAGLINE,
      email: job.organization.contactEmail ?? undefined,
      phone: job.organization.contactPhone ?? undefined,
      website: job.organization.website ?? undefined,
    },
    photos: job.photos.map((p) => ({
      kind: p.kind,
      storagePath: p.storagePath,
      caption: p.caption,
      room: p.room,
      sortOrder: p.sortOrder,
    })),
  });

  return (
    <main className="min-h-screen bg-[#eef2f6] py-8">
      <PhotoReportView document={doc} photoSrc={publicPhotoUrl} />
    </main>
  );
}
