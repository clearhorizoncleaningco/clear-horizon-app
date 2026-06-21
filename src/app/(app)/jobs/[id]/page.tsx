import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/dal";
import { getJob, listAssignableProfiles } from "@/lib/jobs/service";
import { publicPhotoUrl } from "@/lib/jobs/storage";
import { publicEnv } from "@/lib/env";
import { currency0 } from "@/lib/format";
import {
  assignJobAction,
  deleteJobPhotoAction,
  publishReportAction,
  setJobStatusAction,
} from "../actions";
import { PhotoUploader } from "@/components/jobs/photo-uploader";
import { CalibrationForm } from "@/components/jobs/calibration-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export const metadata: Metadata = { title: "Job" };

const dec = (d: { toNumber(): number } | null): number | null => (d == null ? null : d.toNumber());

const NEXT_STATUS: Record<string, { status: string; label: string }[]> = {
  Scheduled: [{ status: "InProgress", label: "Start job" }, { status: "Cancelled", label: "Cancel" }],
  InProgress: [{ status: "Completed", label: "Mark complete" }, { status: "Scheduled", label: "Back to scheduled" }],
  Completed: [{ status: "InProgress", label: "Reopen" }],
  Cancelled: [{ status: "Scheduled", label: "Reschedule" }],
};

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireProfile();
  if (!profile) return null;
  if (profile.role === "Cleaner") redirect(`/cleaner/jobs/${id}`);

  const isAdmin = profile.role === "Admin";
  const [job, assignees] = await Promise.all([
    getJob(profile.organizationId, id),
    listAssignableProfiles(profile.organizationId),
  ]);
  if (!job) notFound();

  const siteUrl = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const reportUrl = `${siteUrl}/report/${job.reportToken}`;
  const before = job.photos.filter((p) => p.kind === "Before");
  const after = job.photos.filter((p) => p.kind === "After");
  const scheduledValue = job.scheduledFor ? toLocalInput(job.scheduledFor) : "";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/jobs" className="text-sm text-muted-foreground hover:text-foreground">← All jobs</Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{job.customerName ?? job.customer?.name ?? "Job"}</h1>
          <p className="text-muted-foreground">{job.summary ?? job.category}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground">{job.status}</span>
          {job.estimateId ? (
            <Link href={`/estimates/${job.estimateId}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              View estimate
            </Link>
          ) : null}
        </div>
      </div>

      {/* Status + assignment */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Status</CardTitle>
            <CardDescription>
              {job.startedAt ? `Started ${fmt(job.startedAt)}. ` : ""}
              {job.completedAt ? `Completed ${fmt(job.completedAt)}.` : "Not completed yet."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {(NEXT_STATUS[job.status] ?? []).map((t) => (
              <form key={t.status} action={setJobStatusAction}>
                <input type="hidden" name="jobId" value={job.id} />
                <input type="hidden" name="status" value={t.status} />
                <Button type="submit" variant={t.status === "Completed" ? "default" : "outline"} size="sm">
                  {t.label}
                </Button>
              </form>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Assignment</CardTitle>
            <CardDescription>{job.assignedToName ? `Assigned to ${job.assignedToName}` : "Unassigned"}</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={assignJobAction} className="flex flex-col gap-3">
              <input type="hidden" name="jobId" value={job.id} />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="assignedToId">Team member</Label>
                <Select id="assignedToId" name="assignedToId" defaultValue={job.assignedToId ?? ""}>
                  <option value="">— Unassigned —</option>
                  {assignees.map((a) => (
                    <option key={a.id} value={a.id}>
                      {(a.fullName ?? a.email)} ({a.role})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="scheduledFor">Scheduled for</Label>
                <Input id="scheduledFor" name="scheduledFor" type="datetime-local" defaultValue={scheduledValue} />
              </div>
              <div>
                <Button type="submit" size="sm" variant="outline">Save assignment</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Photos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Before / after photos</CardTitle>
          <CardDescription>These feed the customer photo report.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <PhotoColumn title="Before" photos={before} jobId={job.id} />
          <PhotoColumn title="After" photos={after} jobId={job.id} />
          <PhotoUploader jobId={job.id} />
        </CardContent>
      </Card>

      {/* Customer report */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Customer photo report</CardTitle>
            <CardDescription>
              {job.reportPublished ? "Published — shareable with the customer." : "Not published yet."}
            </CardDescription>
          </div>
          <form action={publishReportAction}>
            <input type="hidden" name="jobId" value={job.id} />
            <input type="hidden" name="published" value={(!job.reportPublished).toString()} />
            <Button type="submit" size="sm" variant={job.reportPublished ? "outline" : "default"}>
              {job.reportPublished ? "Unpublish" : "Publish report"}
            </Button>
          </form>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <a href={`/report/${job.reportToken}`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" }) + " w-fit"}>
            Preview report
          </a>
          <p className="break-all text-xs text-muted-foreground">
            Share link: <span className="font-mono">{reportUrl}</span>
          </p>
        </CardContent>
      </Card>

      {/* Calibration (Admin only — margin) */}
      {isAdmin ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Calibration (Admin)</CardTitle>
            <CardDescription>
              Quoted {currency0(dec(job.quotedPrice) ?? 0)}. Log actuals to track margin vs. target —{" "}
              <Link href="/calibration" className="text-primary hover:underline">see all calibration</Link>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CalibrationForm
              defaults={{
                jobId: job.id,
                priceCharged: dec(job.priceCharged),
                actualCrewHours: dec(job.actualCrewHours),
                actualLaborCost: dec(job.actualLaborCost),
                actualSuppliesCost: dec(job.actualSuppliesCost),
                cleanerPayAmount: dec(job.cleanerPayAmount),
                calibrationNotes: job.calibrationNotes,
              }}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
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

function fmt(d: Date): string {
  return d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

/** Format a Date as a value for <input type="datetime-local"> (local time). */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
