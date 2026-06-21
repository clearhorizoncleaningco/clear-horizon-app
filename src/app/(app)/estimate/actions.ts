"use server";

import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/dal";
import { saveResidentialEstimate, type SaveContext } from "@/lib/estimates/service";
import { findCustomerDuplicates, searchCustomers, type CustomerListItem } from "@/lib/customers/service";
import type { DuplicateCandidate, DuplicateQuery } from "@/lib/customers/dedupe";
import { saveResidentialEstimateSchema, type SaveResidentialEstimateDTO } from "@/lib/quotes/schema";

/** Resolve the org-scoped save context, or throw if not provisioned. */
async function orgContext(): Promise<SaveContext> {
  const { user, profile } = await requireProfile();
  if (!profile) throw new Error("Your account isn't linked to an organization yet.");
  return { organizationId: profile.organizationId, userId: user.id, userEmail: profile.email };
}

/**
 * Save a residential estimate (recomputed server-side) and redirect to its
 * detail page. Returns an error object only on failure; success redirects.
 */
export async function saveResidentialEstimateAction(
  payload: SaveResidentialEstimateDTO,
): Promise<{ ok: false; error: string }> {
  const ctx = await orgContext();
  const parsed = saveResidentialEstimateSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the quote details." };
  }

  let id: string;
  try {
    id = await saveResidentialEstimate(ctx, parsed.data);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not save the estimate." };
  }
  redirect(`/estimates/${id}`);
}

/** Type-ahead customer search for the wizard (Phase 2 §F). */
export async function searchCustomersAction(query: string): Promise<CustomerListItem[]> {
  const ctx = await orgContext();
  return searchCustomers(ctx.organizationId, query, 8);
}

/** Live duplicate detection for the wizard's customer step (§F). */
export async function findDuplicatesAction(query: DuplicateQuery): Promise<DuplicateCandidate[]> {
  const ctx = await orgContext();
  return findCustomerDuplicates(ctx.organizationId, query);
}
