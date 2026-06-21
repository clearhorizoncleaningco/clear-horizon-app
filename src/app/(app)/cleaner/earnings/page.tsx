import type { Metadata } from "next";
import Link from "next/link";
import { requireProfile } from "@/lib/auth/dal";
import { listJobs } from "@/lib/jobs/service";
import { computeCleanerEarnings, type EarningJobRow } from "@/lib/jobs/earnings";
import { currency } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "My earnings" };

export default async function CleanerEarnings() {
  const { user, profile } = await requireProfile();
  if (!profile) return null;

  const jobs = await listJobs(profile.organizationId, { assignedToId: user.id });
  const rows: EarningJobRow[] = jobs.map((j) => ({
    id: j.id,
    completedAt: j.completedAt,
    status: j.status,
    summary: j.summary,
    customerName: j.customerName ?? j.customer?.name ?? null,
    cleanerPayAmount: j.cleanerPayAmount ? j.cleanerPayAmount.toNumber() : null,
    actualCrewHours: j.actualCrewHours ? j.actualCrewHours.toNumber() : null,
  }));
  const earnings = computeCleanerEarnings(rows);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/cleaner" className="text-sm text-muted-foreground hover:text-foreground">← My jobs</Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">My earnings</h1>
        <p className="text-muted-foreground">Pay across your completed jobs.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total earnings" value={currency(earnings.totalEarnings)} hint={`${earnings.completedCount} completed`} />
        <Stat label="Total hours" value={String(earnings.totalHours)} hint="crew hours logged" />
        <Stat label="Avg per job" value={currency(earnings.avgPerJob)} hint="over paid jobs" />
        <Stat
          label="Awaiting pay"
          value={String(earnings.pendingCount)}
          hint="completed, not yet paid out"
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">By month</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {earnings.byMonth.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">No completed jobs yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {earnings.byMonth.map((m) => (
                <li key={m.key} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <div className="font-medium">{m.label}</div>
                    <div className="text-sm text-muted-foreground">{m.jobs} job{m.jobs === 1 ? "" : "s"} · {m.hours} hrs</div>
                  </div>
                  <span className="font-semibold tabular-nums">{currency(m.earnings)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent completed jobs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {earnings.recent.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">No completed jobs yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {earnings.recent.map((j) => (
                <li key={j.id}>
                  <Link href={`/cleaner/jobs/${j.id}`} className="flex items-center justify-between gap-4 px-6 py-3 hover:bg-muted/50">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{j.customerName ?? "Job"}</div>
                      <div className="truncate text-sm text-muted-foreground">
                        {j.summary ?? ""}
                        {j.completedAt ? ` · ${new Date(j.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
                      </div>
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {j.cleanerPayAmount != null ? currency(j.cleanerPayAmount) : "—"}
                    </span>
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

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
