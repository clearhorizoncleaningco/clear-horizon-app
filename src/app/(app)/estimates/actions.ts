"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/dal";
import { createProposalFromEstimate, pushProposalToGhl } from "@/lib/proposals/service";

async function requireOrgId(): Promise<string> {
  const { profile } = await requireProfile();
  if (!profile) throw new Error("Your account isn't linked to an organization yet.");
  return profile.organizationId;
}

/** Generate (issue) a branded proposal from a saved estimate (§G). */
export async function generateProposalAction(formData: FormData): Promise<void> {
  const orgId = await requireOrgId();
  const estimateId = String(formData.get("estimateId") ?? "");
  if (!estimateId) throw new Error("Missing estimate id.");
  await createProposalFromEstimate(orgId, estimateId);
  revalidatePath(`/estimates/${estimateId}`);
}

/** Run the (stubbed) one-way GHL push for a proposal and record the payload (§B). */
export async function pushToGhlAction(formData: FormData): Promise<void> {
  const orgId = await requireOrgId();
  const proposalId = String(formData.get("proposalId") ?? "");
  const estimateId = String(formData.get("estimateId") ?? "");
  if (!proposalId) throw new Error("Missing proposal id.");
  await pushProposalToGhl(orgId, proposalId);
  revalidatePath(`/estimates/${estimateId}`);
}
