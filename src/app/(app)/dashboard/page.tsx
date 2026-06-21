import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/dal";
import { getDashboardData } from "@/lib/dashboard/service";
import { currency0, percent } from "@/lib/format";
import { BarList } from "@/components/charts/bar-list";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Dashboard" };

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function DashboardPage() {
  const { user, profile } = await requireProfile();

  if (!profile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Account not provisioned</CardTitle>
          <CardDescription>
            You&apos;re signed in as {user.email}, but this account isn&apos;t linked to an
            organization yet. Ask an admin to run the seed/invite step.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Cleaners get their own focused view.
  if (profile.role === "Cleaner") redirect("/cleaner");

  const firstName = profile.fullName?.split(" ")[0] ?? "there";
  const isAdmin = profile.role === "Admin";
  const { kpis, byFrequency, byTier, revenueProjection, activity } = await getDashboardData(
    profile.organizationId,
  );

  const stats = [
    { label: "Estimates today", value: String(kpis.estimatesToday), hint: `${kpis.estimatesThisMonth} this month` },
    { label: "Projected monthly recurring", value: currency0(kpis.projectedMonthlyRecurring), hint: "booked recurring quotes" },
    {
      label: "Conversion",
      value: kpis.conversionProposed > 0 ? percent(kpis.conversionRate, 0) : "—",
      hint: `${kpis.conversionApproved} of ${kpis.conversionProposed} proposed`,
    },
    { label: "Avg. ticket", value: currency0(kpis.avgTicket), hint: `${kpis.totalEstimates} estimates total` },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Welcome, {firstName}</h1>
        <p className="text-muted-foreground">{profile.organization.name} · estimating platform</p>
      </div>

      {/* Quick actions */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-primary/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">New residential estimate</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/estimate/new" className={buttonVariants()}>Start estimate →</Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">New commercial quote</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/commercial/new" className={buttonVariants({ variant: "outline" })}>Start commercial →</Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/jobs" className={buttonVariants({ variant: "outline" })}>View jobs →</Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Reports</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/reports" className={buttonVariants({ variant: "outline" })}>Open reports →</Link>
          </CardContent>
        </Card>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{stat.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{stat.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Monthly revenue projection</CardTitle>
            <CardDescription>Estimated revenue by month (recurring → monthly value, one-time → ticket).</CardDescription>
          </CardHeader>
          <CardContent>
            <BarList bars={revenueProjection} metric="value" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Estimates by frequency</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList bars={byFrequency} metric="count" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Estimates by city / tier</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList bars={byTier} metric="count" />
          </CardContent>
        </Card>
      </div>

      {/* Activity feed */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent activity</CardTitle>
          <CardDescription>Latest estimates and jobs across your organization.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {activity.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              No activity yet. Start an estimate above — it&apos;ll show up here once saved.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {activity.map((item) => (
                <li key={item.id}>
                  <Link href={item.href} className="flex items-center justify-between gap-4 px-6 py-3 hover:bg-muted/50">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          item.kind === "job"
                            ? "bg-secondary text-secondary-foreground"
                            : "bg-primary/10 text-primary"
                        }`}
                      >
                        {item.kind}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{item.title}</div>
                        <div className="truncate text-sm text-muted-foreground">{item.detail}</div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground">
                      {item.amount != null ? <span className="font-semibold tabular-nums text-foreground">{currency0(item.amount)}</span> : null}
                      <span className="tabular-nums">{timeAgo(item.at)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {isAdmin ? (
        <p className="text-sm text-muted-foreground">
          Admin tools:{" "}
          <Link href="/calibration" className="text-primary hover:underline">Calibration</Link> ·{" "}
          <Link href="/admin/pricing" className="text-primary hover:underline">Pricing</Link> ·{" "}
          <Link href="/admin/audit" className="text-primary hover:underline">Audit log</Link>
        </p>
      ) : null}
    </div>
  );
}
