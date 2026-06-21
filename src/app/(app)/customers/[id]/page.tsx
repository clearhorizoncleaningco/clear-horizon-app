import type { Metadata } from "next";
import Link from "next/link";
import { requireProfile } from "@/lib/auth/dal";
import { getCustomer } from "@/lib/customers/service";
import { currency0 } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Customer" };

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const customer = await getCustomer(profile.organizationId, id);
  if (!customer) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Customer not found</CardTitle>
          <CardDescription>It may have been removed, or belongs to another organization.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/customers" className={buttonVariants({ variant: "outline" })}>← All customers</Link>
        </CardContent>
      </Card>
    );
  }

  const contact = [customer.email, customer.phone].filter(Boolean).join(" · ");
  const address = [customer.address, customer.city, customer.zip].filter(Boolean).join(", ");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/customers" className="text-sm text-muted-foreground hover:text-foreground">← All customers</Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{customer.name}</h1>
        <p className="text-muted-foreground">
          {customer.type} customer{contact ? ` · ${contact}` : ""}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Contact</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {customer.email ? <div>{customer.email}</div> : null}
            {customer.phone ? <div>{customer.phone}</div> : null}
            {address ? <div className="text-muted-foreground">{address}</div> : null}
            {!customer.email && !customer.phone && !address ? (
              <div className="text-muted-foreground">No contact details on file.</div>
            ) : null}
          </CardContent>
        </Card>
        {customer.notes ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">{customer.notes}</CardContent>
          </Card>
        ) : null}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Estimates ({customer.estimates.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {customer.estimates.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">No estimates yet for this customer.</p>
          ) : (
            <ul className="divide-y divide-border">
              {customer.estimates.map((e) => (
                <li key={e.id}>
                  <Link href={`/estimates/${e.id}`} className="flex items-center justify-between gap-4 px-6 py-3 hover:bg-muted/50">
                    <div className="min-w-0">
                      <div className="truncate text-sm">{e.summary ?? e.category}</div>
                      <div className="text-xs text-muted-foreground">
                        {e.status} ·{" "}
                        {e.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </div>
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
