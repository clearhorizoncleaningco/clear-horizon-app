"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { approvalSubmissionSchema } from "@/lib/proposals/approval";
import { approveProposalByToken } from "@/lib/proposals/service";

export interface ApprovalFormState {
  ok: boolean;
  error?: string;
}

/** Read the client IP from proxy headers (Vercel sets x-forwarded-for). */
async function readClientIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return h.get("x-real-ip");
}

/**
 * Public e-approval submission (BUILD_SPEC §G): validates "I agree" + typed name,
 * captures timestamp + IP, and records the approval. Used with useActionState.
 */
export async function submitApprovalAction(
  _prev: ApprovalFormState,
  formData: FormData,
): Promise<ApprovalFormState> {
  const token = String(formData.get("token") ?? "");
  const agree = formData.get("agree") === "on" || formData.get("agree") === "true";
  const signerName = String(formData.get("signerName") ?? "");

  const parsed = approvalSubmissionSchema.safeParse({ agree, signerName });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please complete the form." };
  }

  const ip = await readClientIp();
  const result = await approveProposalByToken(token, parsed.data, ip);
  if (!result.ok) {
    return { ok: false, error: result.message ?? "This proposal can no longer be approved." };
  }

  revalidatePath(`/approve/${token}`);
  return { ok: true };
}
