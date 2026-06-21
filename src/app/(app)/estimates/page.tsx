import type { Metadata } from "next";
import Link from "next/link";
import { requireProfile } from "@/lib/auth/dal";
import { listEstimates } from "@/lib/estimates/service";
import { currency0 } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Estimates" };

const STATUS_STYLES: Record<string, string> = {
  Saved: "bg-secondary text-secondary-foreground",
  Proposed: "bg-primary/15 text-primary",
  Approved: "bg-green-600/15 text-green-700 dark:text-green-400",
  Declined: "bg-brand-gold/20 text-brand-navy",
  Expired: "bg-muted text-muted-foreground",
  Draft: "bg-muted text-muted-foreground",
};

export default async function EstimatesPage() {
  const { profile } = await requireProfile();
  if (!profile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Account not provisioned</CardTitle>
          <CardDescription>Ask an admin to run the seed/invite step.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const estimates = await listEstimates(profile.organizationId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Estimates</h1>
          <p className="text-muted-foreground">{profile.organization.name}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/estimate/new" className={buttonVariants()}>New residential</Link>
          <Link href="/commercial/new" className={buttonVariants({ variant: "outline" })}>New commercial</Link>
        </div>
      </div>

      {estimates.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>No estimates yet</CardTitle>
            <CardDescription>Quote a job from the wizard and click Save to see it here.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {estimates.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/estimates/${e.id}`}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{e.customer?.name ?? "No customer"}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[e.status] ?? ""}`}>
                          {e.status}
                        </span>
                      </div>
                      <div className="truncate text-sm text-muted-foreground">{e.summary ?? e.category}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold tabular-nums">{currency0(Number(e.headlinePrice))}</div>
                      <div className="text-xs text-muted-foreground">
                        {e.isRecurring && e.frequencyLabel ? e.frequencyLabel : e.category}
                        {e.proposals.length > 0 ? ` · ${e.proposals.length} proposal${e.proposals.length > 1 ? "s" : ""}` : ""}
                      </div>
                    </div>
                    <div className="hidden w-28 text-right text-xs text-muted-foreground sm:block">
                      {e.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
