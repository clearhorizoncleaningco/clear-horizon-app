/**
 * Customer duplicate detection (BUILD_SPEC §F step 1 / §G) — a PURE module.
 *
 * No Prisma, no `server-only`: the service layer loads candidate customers from
 * the DB (org-scoped) and hands them to these functions, which also run safely
 * in a Client Component for the wizard's live "possible duplicate" hint.
 *
 * Matching is intentionally simple and explainable (we surface the reasons to
 * the rep): exact email, exact phone (last 10 digits), or name + locality.
 */

export interface CustomerLike {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  phoneNormalized?: string | null;
  address?: string | null;
  city?: string | null;
  zip?: string | null;
}

export interface DuplicateQuery {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  zip?: string | null;
}

export interface DuplicateCandidate {
  customer: CustomerLike;
  score: number; // 0–100; higher = more likely the same customer
  reasons: string[];
}

/** Digits only, keeping the trailing 10 (drops a US country code / formatting). */
export function normalizePhone(raw: string | null | undefined): string {
  const digits = (raw ?? "").replace(/\D+/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

/** Trimmed, lower-cased email for case-insensitive comparison. */
export function normalizeEmail(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase();
}

/** Lower-cased, whitespace-collapsed text for loose name/address comparison. */
export function normalizeText(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

// Signal weights. Email/phone are strong identity signals; name alone is weak.
const SCORE_EMAIL = 100;
const SCORE_PHONE = 95;
const SCORE_NAME_AND_LOCALITY = 75;
const SCORE_NAME_ONLY = 45;

/** Default cutoff: surface name-only matches and stronger. */
export const DEFAULT_DUPLICATE_THRESHOLD = SCORE_NAME_ONLY;

/** Score a single existing customer against the query. `score` is the strongest
 *  individual signal (not a sum), so an email match is decisive on its own. */
export function scoreDuplicate(existing: CustomerLike, query: DuplicateQuery): DuplicateCandidate {
  const reasons: string[] = [];
  let score = 0;

  const qEmail = normalizeEmail(query.email);
  const eEmail = normalizeEmail(existing.email);
  if (qEmail && eEmail && qEmail === eEmail) {
    score = Math.max(score, SCORE_EMAIL);
    reasons.push("Same email");
  }

  const qPhone = normalizePhone(query.phone);
  const ePhone = existing.phoneNormalized
    ? normalizePhone(existing.phoneNormalized)
    : normalizePhone(existing.phone);
  if (qPhone.length >= 10 && ePhone.length >= 10 && qPhone === ePhone) {
    score = Math.max(score, SCORE_PHONE);
    reasons.push("Same phone");
  }

  const qName = normalizeText(query.name);
  const eName = normalizeText(existing.name);
  if (qName && eName && qName === eName) {
    const qZip = normalizeText(query.zip);
    const eZip = normalizeText(existing.zip);
    const qAddr = normalizeText(query.address);
    const eAddr = normalizeText(existing.address);
    const sameZip = !!qZip && qZip === eZip;
    const sameAddr = !!qAddr && qAddr === eAddr;
    if (sameZip || sameAddr) {
      score = Math.max(score, SCORE_NAME_AND_LOCALITY);
      reasons.push(sameAddr ? "Same name & address" : "Same name & ZIP");
    } else {
      score = Math.max(score, SCORE_NAME_ONLY);
      reasons.push("Same name");
    }
  }

  return { customer: existing, score, reasons };
}

/**
 * Rank existing customers as duplicate candidates for the query, strongest
 * first. Only candidates at/above `threshold` are returned.
 */
export function findDuplicateCandidates(
  existing: CustomerLike[],
  query: DuplicateQuery,
  threshold: number = DEFAULT_DUPLICATE_THRESHOLD,
): DuplicateCandidate[] {
  return existing
    .map((c) => scoreDuplicate(c, query))
    .filter((c) => c.score >= threshold)
    .sort((a, b) => b.score - a.score);
}
