import type { Metadata } from "next";
import Link from "next/link";
import { requireProfile } from "@/lib/auth/dal";
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

      {/* Placeholder metric cards — populated by the estimator in Phase 1. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Estimates today", hint: "Coming in Phase 1" },
          { label: "Estimates this month", hint: "Coming in Phase 1" },
          { label: "Est. monthly revenue", hint: "Coming in Phase 1" },
          { label: "Avg. ticket", hint: "Coming in Phase 1" },
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

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>No estimates yet</CardTitle>
          <CardDescription>
            The foundation is in place: auth, your organization, and all pricing tables are
            seeded and Admin-editable. The estimate wizard and residential pricing engine arrive
            in Phase 1.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <span className="inline-flex items-center rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            New estimate · available in Phase 1
          </span>
        </CardContent>
      </Card>
    </div>
  );
}
