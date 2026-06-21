import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth/dal";
import { getJob } from "@/lib/jobs/service";
import { publicPhotoUrl } from "@/lib/jobs/storage";
import { currency } from "@/lib/format";
import { deleteJobPhotoAction, setJobStatusAction } from "../../../jobs/actions";
import { PhotoUploader } from "@/components/jobs/photo-uploader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "My job" };

export default async function CleanerJobDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, profile } = await requireProfile();
  if (!profile) return null;

  const job = await getJob(profile.organizationId, id);
  // A cleaner may only open a job assigned to them (Admin may preview any).
  if (!job || (profile.role === "Cleaner" && job.assignedToId !== user.id)) notFound();

  const before = job.photos.filter((p) => p.kind === "Before");
  const after = job.photos.filter((p) => p.kind === "After");
  const pay = job.cleanerPayAmount ? job.cleanerPayAmount.toNumber() : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/cleaner" className="text-sm text-muted-foreground hover:text-foreground">← My jobs</Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{job.customerName ?? job.customer?.name ?? "Job"}</h1>
          <p className="text-muted-foreground">{job.summary ?? job.category}</p>
          {[job.address, job.city].filter(Boolean).length > 0 ? (
            <p className="text-sm text-muted-foreground">{[job.address, job.city].filter(Boolean).join(", ")}</p>
          ) : null}
        </div>
        <span className="rounded-full bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground">{job.status}</span>
      </div>

      {/* Progress */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Mark progress</CardTitle>
          <CardDescription>
            {job.status === "Scheduled" && "Start the job when you arrive."}
            {job.status === "InProgress" && "Add your before/after photos, then mark complete."}
            {job.status === "Completed" && "Completed — thank you!"}
            {job.status === "Cancelled" && "This job was cancelled."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {job.status === "Scheduled" ? (
            <StatusButton jobId={job.id} status="InProgress" label="Start job" />
          ) : null}
          {job.status === "InProgress" ? (
            <StatusButton jobId={job.id} status="Completed" label="Mark complete" variant="default" />
          ) : null}
        </CardContent>
      </Card>

      {/* Pay (their own earnings — not company margin) */}
      {pay != null ? (
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Your pay for this job</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{currency(pay)}</CardTitle>
          </CardHeader>
        </Card>
      ) : null}

      {/* Photos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Before / after photos</CardTitle>
          <CardDescription>These build the customer&apos;s report.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <PhotoColumn title="Before" photos={before} jobId={job.id} />
          <PhotoColumn title="After" photos={after} jobId={job.id} />
          <PhotoUploader jobId={job.id} />
        </CardContent>
      </Card>

      {job.reportPublished ? (
        <a href={`/report/${job.reportToken}`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline" }) + " w-fit"}>
          View customer report
        </a>
      ) : null}
    </div>
  );
}

function StatusButton({
  jobId,
  status,
  label,
  variant = "outline",
}: {
  jobId: string;
  status: string;
  label: string;
  variant?: "default" | "outline";
}) {
  return (
    <form action={setJobStatusAction}>
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="status" value={status} />
      <Button type="submit" variant={variant}>{label}</Button>
    </form>
  );
}

function PhotoColumn({
  title,
  photos,
  jobId,
}: {
  title: string;
  photos: { id: string; storagePath: string; caption: string | null; room: string | null }[];
  jobId: string;
}) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold">{title}</div>
      {photos.length === 0 ? (
        <p className="text-sm text-muted-foreground">No {title.toLowerCase()} photos yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p) => (
            <figure key={p.id} className="overflow-hidden rounded-lg border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={publicPhotoUrl(p.storagePath)} alt={p.caption ?? p.room ?? title} className="h-28 w-full object-cover" />
              <figcaption className="flex items-center justify-between gap-2 p-1.5 text-xs">
                <span className="truncate">{p.caption ?? p.room ?? ""}</span>
                <form action={deleteJobPhotoAction}>
                  <input type="hidden" name="jobId" value={jobId} />
                  <input type="hidden" name="photoId" value={p.id} />
                  <button type="submit" className="text-muted-foreground hover:text-red-600" aria-label="Delete photo">×</button>
                </form>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
