import type { Metadata } from "next";
import Link from "next/link";
import { requireProfile } from "@/lib/auth/dal";
import { listJobs } from "@/lib/jobs/service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "My jobs" };

const STATUS_STYLES: Record<string, string> = {
  Scheduled: "bg-secondary text-secondary-foreground",
  InProgress: "bg-brand-gold/20 text-brand-navy dark:text-brand-gold",
  Completed: "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300",
  Cancelled: "bg-muted text-muted-foreground",
};

function fmt(d: Date | null): string {
  return d ? d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Not scheduled";
}

export default async function CleanerHome() {
  const { user, profile } = await requireProfile();
  if (!profile) return null;

  const jobs = await listJobs(profile.organizationId, { assignedToId: user.id });
  const active = jobs.filter((j) => j.status === "Scheduled" || j.status === "InProgress");
  const finished = jobs.filter((j) => j.status === "Completed");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My jobs</h1>
          <p className="text-muted-foreground">{active.length} active · {finished.length} completed</p>
        </div>
        <Link href="/cleaner/earnings" className={buttonVariants({ variant: "outline" })}>My earnings →</Link>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Assigned to me</CardTitle>
          <CardDescription>Tap a job to mark progress and add before/after photos.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {jobs.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">No jobs assigned to you yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {jobs.map((job) => (
                <li key={job.id}>
                  <Link href={`/cleaner/jobs/${job.id}`} className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-muted/50">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{job.customerName ?? job.customer?.name ?? "Job"}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[job.status] ?? "bg-muted"}`}>
                          {job.status}
                        </span>
                      </div>
                      <div className="truncate text-sm text-muted-foreground">{job.summary ?? job.category}</div>
                      <div className="text-xs text-muted-foreground">{fmt(job.scheduledFor)}</div>
                    </div>
                    <span className="shrink-0 text-sm text-primary">Open →</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
