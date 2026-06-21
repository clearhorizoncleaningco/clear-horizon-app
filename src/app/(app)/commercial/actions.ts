"use server";

import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/dal";
import { saveCommercialEstimate, type SaveContext } from "@/lib/estimates/service";
import { saveCommercialEstimateSchema, type SaveCommercialEstimateDTO } from "@/lib/quotes/schema";

async function orgContext(): Promise<SaveContext> {
  const { user, profile } = await requireProfile();
  if (!profile) throw new Error("Your account isn't linked to an organization yet.");
  return { organizationId: profile.organizationId, userId: user.id, userEmail: profile.email };
}

/** Save a manual commercial quote (§E.8) and redirect to its detail page. */
export async function saveCommercialEstimateAction(
  payload: SaveCommercialEstimateDTO,
): Promise<{ ok: false; error: string }> {
  const ctx = await orgContext();
  const parsed = saveCommercialEstimateSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the quote details." };
  }

  let id: string;
  try {
    id = await saveCommercialEstimate(ctx, parsed.data);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not save the quote." };
  }
  redirect(`/estimates/${id}`);
}
