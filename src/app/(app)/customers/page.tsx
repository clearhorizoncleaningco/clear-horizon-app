import type { Metadata } from "next";
import Link from "next/link";
import { requireProfile } from "@/lib/auth/dal";
import { searchCustomers } from "@/lib/customers/service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
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

  const { q = "" } = await searchParams;
  const customers = await searchCustomers(profile.organizationId, q, 50);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
        <p className="text-muted-foreground">{profile.organization.name}</p>
      </div>

      <form className="flex gap-2" action="/customers" method="get">
        <Input name="q" defaultValue={q} placeholder="Search by name, email, or phone…" className="max-w-sm" />
        <Button type="submit" variant="outline">Search</Button>
        {q ? (
          <Link href="/customers" className="self-center text-sm text-muted-foreground hover:text-foreground">
            Clear
          </Link>
        ) : null}
      </form>

      {customers.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>{q ? "No matches" : "No customers yet"}</CardTitle>
            <CardDescription>
              {q ? "Try a different search." : "Customers are created when you save a quote with a name."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {customers.map((c) => (
                <li key={c.id}>
                  <Link href={`/customers/${c.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/50">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{c.name}</span>
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                          {c.type}
                        </span>
                      </div>
                      <div className="truncate text-sm text-muted-foreground">
                        {[c.email, c.phone, [c.city, c.zip].filter(Boolean).join(" ")].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <span className="text-sm text-muted-foreground">View →</span>
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
