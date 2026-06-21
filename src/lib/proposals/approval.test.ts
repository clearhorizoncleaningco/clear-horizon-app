import { describe, expect, it } from "vitest";
import {
  approvalSubmissionSchema,
  buildApprovalRecord,
  canApprove,
  evaluateProposal,
  isExpired,
  type ProposalApprovalState,
} from "./approval";

const NOW = new Date("2026-06-20T12:00:00.000Z");
const future = new Date("2026-07-20T12:00:00.000Z");
const past = new Date("2026-06-01T12:00:00.000Z");

describe("expiration", () => {
  it("detects expired vs live", () => {
    expect(isExpired(past, NOW)).toBe(true);
    expect(isExpired(future, NOW)).toBe(false);
  });
});

describe("evaluateProposal", () => {
  const base: ProposalApprovalState = { status: "Sent", expiresAt: future };

  it("is approvable while live and untouched", () => {
    expect(evaluateProposal(base, NOW)).toBe("approvable");
    expect(canApprove(base, NOW)).toBe(true);
  });

  it("is expired past the 30-day window", () => {
    expect(evaluateProposal({ ...base, expiresAt: past }, NOW)).toBe("expired");
    expect(canApprove({ ...base, expiresAt: past }, NOW)).toBe(false);
  });

  it("shows approved/declined even after expiry (terminal wins)", () => {
    expect(evaluateProposal({ status: "Approved", expiresAt: past, approvedAt: past }, NOW)).toBe("approved");
    expect(evaluateProposal({ status: "Declined", expiresAt: past, declinedAt: past }, NOW)).toBe("declined");
  });
});

describe("approvalSubmissionSchema", () => {
  it("requires the checkbox to be true", () => {
    const r = approvalSubmissionSchema.safeParse({ agree: false, signerName: "Jane Doe" });
    expect(r.success).toBe(false);
  });
  it("requires a real name", () => {
    expect(approvalSubmissionSchema.safeParse({ agree: true, signerName: "" }).success).toBe(false);
    expect(approvalSubmissionSchema.safeParse({ agree: true, signerName: "J" }).success).toBe(false);
  });
  it("accepts a valid submission", () => {
    const r = approvalSubmissionSchema.safeParse({ agree: true, signerName: "  Jane Doe  " });
    expect(r.success).toBe(true);
  });
});

describe("buildApprovalRecord", () => {
  it("captures name, IP, and timestamp", () => {
    const rec = buildApprovalRecord({ agree: true, signerName: "  Jane Doe " }, "203.0.113.7", NOW);
    expect(rec).toEqual({
      agreed: true,
      signerName: "Jane Doe",
      signerIp: "203.0.113.7",
      approvedAt: NOW,
      status: "Approved",
    });
  });
  it("tolerates a missing IP", () => {
    expect(buildApprovalRecord({ agree: true, signerName: "Jane Doe" }, null, NOW).signerIp).toBeNull();
  });
});

// End-to-end logic the public approval page + submit action run through (the
// only piece not exercised here is the Prisma write, which is typechecked/built).
describe("approval flow (end-to-end logic)", () => {
  it("Sent → reject bad input → approve with capture → now Approved; expired is blocked", () => {
    const live: ProposalApprovalState = { status: "Sent", expiresAt: future };

    // 1. A live, untouched proposal is approvable.
    expect(canApprove(live, NOW)).toBe(true);

    // 2. Missing the checkbox is rejected before any write.
    expect(approvalSubmissionSchema.safeParse({ agree: false, signerName: "Jane Doe" }).success).toBe(false);

    // 3. A valid "I agree" + typed name produces the persisted approval capture.
    const submission = approvalSubmissionSchema.parse({ agree: true, signerName: "Jane Doe" });
    const record = buildApprovalRecord(submission, "198.51.100.22", NOW);
    expect(record.signerName).toBe("Jane Doe");
    expect(record.signerIp).toBe("198.51.100.22");
    expect(record.approvedAt).toBe(NOW);

    // 4. After persisting that record, the page shows the approved view.
    const approved: ProposalApprovalState = {
      status: record.status,
      expiresAt: future,
      approvedAt: record.approvedAt,
    };
    expect(evaluateProposal(approved, NOW)).toBe("approved");

    // 5. A separate, expired proposal can never be approved.
    expect(canApprove({ status: "Sent", expiresAt: past }, NOW)).toBe(false);
  });
});
