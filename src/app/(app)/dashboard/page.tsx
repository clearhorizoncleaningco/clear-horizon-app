import type { Metadata } from "next";
import Link from "next/link";
import { requireProfile } from "@/lib/auth/dal";
import { listEstimates } from "@/lib/estimates/service";
import { currency0 } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const { user, profile } = await requireProfile();

  // A signed-in user with no Profile row = account not yet provisioned to an org.
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

  const firstName = profile.fullName?.split(" ")[0] ?? "there";
  const isAdmin = profile.role === "Admin";
  const recent = await listEstimates(profile.organizationId, 5);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Welcome, {firstName}</h1>
        <p className="text-muted-foreground">
          {profile.organization.name} · estimating platform
        </p>
      </div>

      {/* Quick actions — the Phase 1 estimator */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle>New residential estimate</CardTitle>
            <CardDescription>Guided wizard with a live running price.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/estimate/new" className={buttonVariants()}>Start estimate →</Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>New commercial quote</CardTitle>
            <CardDescription>Manual walk-through price + line items.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/commercial/new" className={buttonVariants({ variant: "outline" })}>Start commercial →</Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customers</CardTitle>
            <CardDescription>Search records, profiles &amp; quote history.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/customers" className={buttonVariants({ variant: "outline" })}>View customers →</Link>
          </CardContent>
        </Card>

        {isAdmin ? (
          <Card>
            <CardHeader>
              <CardTitle>Pricing settings</CardTitle>
              <CardDescription>Edit any rate, multiplier, fee or rule.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/pricing" className={buttonVariants({ variant: "outline" })}>Open settings →</Link>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {/* Metric cards — KPIs/charts arrive in Phase 3. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Estimates today", hint: "KPIs arrive in Phase 3" },
          { label: "Estimates this month", hint: "KPIs arrive in Phase 3" },
          { label: "Est. monthly revenue", hint: "KPIs arrive in Phase 3" },
          { label: "Avg. ticket", hint: "KPIs arrive in Phase 3" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-3xl">—</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{stat.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent estimates (Phase 2 — save & retrieve). */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Recent estimates</CardTitle>
            <CardDescription>Your latest saved quotes.</CardDescription>
          </div>
          <Link href="/estimates" className={buttonVariants({ variant: "outline" })}>View all →</Link>
        </CardHeader>
        <CardContent className="p-0">
          {recent.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              No estimates yet. Start one above and click Save to see it here.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((e) => (
                <li key={e.id}>
                  <Link href={`/estimates/${e.id}`} className="flex items-center justify-between gap-4 px-6 py-3 hover:bg-muted/50">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{e.customer?.name ?? "No customer"}</div>
                      <div className="truncate text-sm text-muted-foreground">{e.summary ?? e.category}</div>
                    </div>
                    <span className="font-semibold tabular-nums">{currency0(Number(e.headlinePrice))}</span>
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
