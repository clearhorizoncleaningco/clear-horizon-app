import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/dal";
import { listJobs } from "@/lib/jobs/service";
import { currency0 } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Jobs" };

const STATUS_STYLES: Record<string, string> = {
  Scheduled: "bg-secondary text-secondary-foreground",
  InProgress: "bg-brand-gold/20 text-brand-navy dark:text-brand-gold",
  Completed: "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300",
  Cancelled: "bg-muted text-muted-foreground",
};

export default async function JobsPage() {
  const { profile } = await requireProfile();
  if (!profile) return null;
  if (profile.role === "Cleaner") redirect("/cleaner");

  const jobs = await listJobs(profile.organizationId);
  const open = jobs.filter((j) => j.status !== "Completed" && j.status !== "Cancelled");
  const done = jobs.filter((j) => j.status === "Completed");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Jobs</h1>
        <p className="text-muted-foreground">
          {open.length} open · {done.length} completed. Convert a saved estimate into a job from its page.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">All jobs</CardTitle>
          <CardDescription>Newest first.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {jobs.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              No jobs yet. Open a saved estimate and choose <span className="font-medium">Convert to job</span>.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {jobs.map((job) => (
                <li key={job.id}>
                  <Link href={`/jobs/${job.id}`} className="flex items-center justify-between gap-4 px-6 py-3 hover:bg-muted/50">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{job.customerName ?? job.customer?.name ?? "Job"}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[job.status] ?? "bg-muted"}`}>
                          {job.status}
                        </span>
                      </div>
                      <div className="truncate text-sm text-muted-foreground">
                        {job.summary ?? job.category}
                        {job.assignedToName ? ` · ${job.assignedToName}` : " · unassigned"}
                        {job._count.photos > 0 ? ` · ${job._count.photos} photo${job._count.photos === 1 ? "" : "s"}` : ""}
                      </div>
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums">{currency0(Number(job.quotedPrice))}</span>
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
