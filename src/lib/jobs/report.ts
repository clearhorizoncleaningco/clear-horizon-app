/**
 * The customer photo report (BUILD_SPEC §G Phase 3) — a PURE, customer-facing
 * projection of a completed job.
 *
 * CRITICAL (CLAUDE.md §3.5 / §5), exactly like the Phase 2 ProposalDocument:
 * this shape has NO price / margin / labor / cost fields by construction. The
 * builder maps a job + its before/after photos into this document and simply
 * never copies any internal economics across, so the public report page (and any
 * future shared link) literally cannot leak them. Enforced by report.test.ts.
 *
 * No Prisma, no `server-only`, no React — safe to import in the public page and
 * in tests. Photo URLs are resolved at render time (storagePath → public URL).
 */

export interface PhotoReportProvider {
  companyName: string;
  tagline?: string;
  email?: string;
  phone?: string;
  website?: string;
}

export interface PhotoReportPhoto {
  kind: "Before" | "After";
  /** Storage key (or a leading-"/" local /public path for demo data). */
  storagePath: string;
  caption?: string;
  room?: string;
}

/** Everything needed to render a customer photo report — and nothing that isn't. */
export interface PhotoReportDocument {
  schemaVersion: 1;
  reference: string;
  serviceTitle: string;
  customerName: string;
  summary?: string; // property/service one-liner (NO price)
  serviceDate?: string; // ISO (completedAt)
  address?: string;
  city?: string;
  provider: PhotoReportProvider;
  beforePhotos: PhotoReportPhoto[];
  afterPhotos: PhotoReportPhoto[];
  thankYou: string;
}

export interface BuildPhotoReportInput {
  reference: string;
  customerName: string | null;
  summary?: string | null;
  completedAt?: Date | string | null;
  address?: string | null;
  city?: string | null;
  provider: PhotoReportProvider;
  photos: {
    kind: "Before" | "After";
    storagePath: string;
    caption?: string | null;
    room?: string | null;
    sortOrder?: number;
  }[];
}

function clean(value: string | null | undefined): string | undefined {
  const t = value?.trim();
  return t ? t : undefined;
}

function toReportPhotos(
  photos: BuildPhotoReportInput["photos"],
  kind: "Before" | "After",
): PhotoReportPhoto[] {
  return photos
    .filter((p) => p.kind === kind)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((p) => ({
      kind,
      storagePath: p.storagePath,
      caption: clean(p.caption),
      room: clean(p.room),
    }));
}

export function buildPhotoReport(input: BuildPhotoReportInput): PhotoReportDocument {
  const completed =
    input.completedAt instanceof Date
      ? input.completedAt
      : input.completedAt
        ? new Date(input.completedAt)
        : null;

  return {
    schemaVersion: 1,
    reference: input.reference,
    serviceTitle: "Your Clean — Before & After",
    customerName: clean(input.customerName) ?? "Valued Customer",
    summary: clean(input.summary),
    serviceDate: completed ? completed.toISOString() : undefined,
    address: clean(input.address),
    city: clean(input.city),
    provider: input.provider,
    beforePhotos: toReportPhotos(input.photos, "Before"),
    afterPhotos: toReportPhotos(input.photos, "After"),
    thankYou: `Thank you for choosing ${input.provider.companyName}! Here's a look at the difference our team made. We hope you love the result.`,
  };
}
