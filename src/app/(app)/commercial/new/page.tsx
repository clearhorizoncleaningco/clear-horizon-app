import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth/dal";
import { loadPricingConfig } from "@/lib/quotes/pricing-config";
import { CommercialQuoteForm } from "@/components/commercial/commercial-quote-form";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "New commercial quote",
};

export default async function NewCommercialQuotePage() {
  const { user, profile } = await requireProfile();

  if (!profile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Account not provisioned</CardTitle>
          <CardDescription>
            You&apos;re signed in as {user.email}, but this account isn&apos;t linked to an organization yet.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const config = await loadPricingConfig(profile.organizationId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">New commercial quote</h1>
        <p className="text-muted-foreground">{profile.organization.name} · manual path</p>
      </div>
      <CommercialQuoteForm config={config} orgName={profile.organization.name} />
    </div>
  );
}
