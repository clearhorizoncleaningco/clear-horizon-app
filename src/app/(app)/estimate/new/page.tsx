import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth/dal";
import { loadPricingConfig } from "@/lib/quotes/pricing-config";
import { EstimateWizard } from "@/components/estimate/estimate-wizard";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "New estimate",
};

export default async function NewEstimatePage() {
  const { user, profile } = await requireProfile();

  if (!profile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Account not provisioned</CardTitle>
          <CardDescription>
            You&apos;re signed in as {user.email}, but this account isn&apos;t linked to an organization
            yet. Ask an admin to run the seed/invite step.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const config = await loadPricingConfig(profile.organizationId);

  return (
    <EstimateWizard
      config={config}
      isAdmin={profile.role === "Admin"}
      orgName={profile.organization.name}
    />
  );
}
