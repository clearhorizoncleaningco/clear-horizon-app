/**
 * Proposal approval state machine + e-approval validation (BUILD_SPEC §G) — PURE.
 *
 * The public approval page and the submit action both run through these so the
 * 30-day expiration and "already actioned" rules are decided in ONE tested place.
 * No Prisma / no `server-only`.
 */
import { z } from "zod";

export type ProposalLifecycleStatus = "Draft" | "Sent" | "Approved" | "Declined" | "Expired";

export interface ProposalApprovalState {
  status: ProposalLifecycleStatus;
  expiresAt: Date;
  approvedAt?: Date | null;
  declinedAt?: Date | null;
}

/** What the approval page should render right now. */
export type ApprovalView = "approvable" | "approved" | "declined" | "expired";

export function isExpired(expiresAt: Date, now: Date): boolean {
  return now.getTime() > expiresAt.getTime();
}

/**
 * Resolve the view for the public approval page. Terminal states (approved /
 * declined) win over expiration so a customer who already approved still sees
 * their confirmation even after 30 days.
 */
export function evaluateProposal(state: ProposalApprovalState, now: Date): ApprovalView {
  if (state.status === "Approved" || state.approvedAt) return "approved";
  if (state.status === "Declined" || state.declinedAt) return "declined";
  if (state.status === "Expired" || isExpired(state.expiresAt, now)) return "expired";
  return "approvable";
}

export function canApprove(state: ProposalApprovalState, now: Date): boolean {
  return evaluateProposal(state, now) === "approvable";
}

/** Validates the e-approval form submission ("I agree" + typed name). */
export const approvalSubmissionSchema = z.object({
  agree: z
    .boolean()
    .refine((v) => v === true, { message: "You must check “I agree” to approve this proposal." }),
  signerName: z
    .string()
    .trim()
    .min(2, "Please type your full legal name.")
    .max(200, "Name is too long."),
});

export type ApprovalSubmission = z.infer<typeof approvalSubmissionSchema>;

export interface ApprovalRecord {
  agreed: true;
  signerName: string;
  signerIp: string | null;
  approvedAt: Date;
  status: "Approved";
}

/** The persisted fields for a successful approval (timestamp + IP captured). */
export function buildApprovalRecord(
  submission: ApprovalSubmission,
  signerIp: string | null,
  now: Date,
): ApprovalRecord {
  return {
    agreed: true,
    signerName: submission.signerName.trim(),
    signerIp,
    approvedAt: now,
    status: "Approved",
  };
}
