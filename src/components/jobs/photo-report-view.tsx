import type { CSSProperties } from "react";
import type { PhotoReportDocument, PhotoReportPhoto } from "@/lib/jobs/report";

/**
 * Customer-facing photo report renderer (BUILD_SPEC §G Phase 3 checkpoint:
 * "a customer photo report is generated").
 *
 * Consumes a margin-free `PhotoReportDocument` (src/lib/jobs/report.ts), so it
 * cannot show internal economics (CLAUDE.md §3.5). Deliberately styled with
 * INLINE styles + the §C brand hexes (not Tailwind) and plain <img> (not
 * next/image) so it renders correctly everywhere with zero external CSS — the
 * public page, a saved/printed copy, and the standalone verification artifact.
 *
 * `photoSrc` maps a stored photo path to a displayable URL (Supabase public URL
 * in production; a local /public path for demo data).
 */

const BRAND = {
  navy: "#0D2B45",
  blue: "#1E6FB8",
  lightBlue: "#7CC4F2",
  gold: "#FDB813",
  gray: "#F1F3F6",
};

const s = {
  page: {
    maxWidth: 880,
    margin: "0 auto",
    padding: 24,
    fontFamily:
      "Montserrat, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
    color: BRAND.navy,
    background: "#ffffff",
  } satisfies CSSProperties,
  header: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottom: `3px solid ${BRAND.blue}`,
    paddingBottom: 16,
  } satisfies CSSProperties,
  wordmark: { fontSize: 22, fontWeight: 800, color: BRAND.navy, letterSpacing: -0.3 } satisfies CSSProperties,
  tagline: { fontSize: 12, color: BRAND.blue, fontWeight: 600 } satisfies CSSProperties,
  contact: { fontSize: 12, color: "#5b6b7b", textAlign: "right" } satisfies CSSProperties,
  title: { fontSize: 26, fontWeight: 800, margin: "20px 0 4px" } satisfies CSSProperties,
  meta: { fontSize: 13, color: "#5b6b7b" } satisfies CSSProperties,
  sectionLabel: {
    display: "inline-block",
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: "#ffffff",
    padding: "4px 10px",
    borderRadius: 999,
    margin: "28px 0 12px",
  } satisfies CSSProperties,
  grid: { display: "flex", flexWrap: "wrap", gap: 16 } satisfies CSSProperties,
  card: {
    flex: "1 1 280px",
    minWidth: 260,
    border: `1px solid ${BRAND.gray}`,
    borderRadius: 12,
    overflow: "hidden",
    background: BRAND.gray,
  } satisfies CSSProperties,
  img: { width: "100%", height: 220, objectFit: "cover", display: "block", background: "#dde5ec" } satisfies CSSProperties,
  caption: { padding: "8px 12px", fontSize: 13, fontWeight: 600 } satisfies CSSProperties,
  thanks: {
    marginTop: 28,
    padding: 20,
    borderRadius: 12,
    background: BRAND.navy,
    color: "#ffffff",
    fontSize: 15,
    lineHeight: 1.5,
  } satisfies CSSProperties,
  footer: { marginTop: 20, fontSize: 12, color: "#5b6b7b", textAlign: "center" } satisfies CSSProperties,
};

function fmtDate(iso?: string): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function PhotoGrid({
  photos,
  photoSrc,
  emptyLabel,
}: {
  photos: PhotoReportPhoto[];
  photoSrc: (path: string) => string;
  emptyLabel: string;
}) {
  if (photos.length === 0) {
    return <p style={{ ...s.meta, fontStyle: "italic" }}>{emptyLabel}</p>;
  }
  return (
    <div style={s.grid}>
      {photos.map((p, i) => (
        <figure key={i} style={s.card}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img style={s.img} src={photoSrc(p.storagePath)} alt={p.caption ?? p.room ?? `${p.kind} photo`} />
          {(p.caption || p.room) && (
            <figcaption style={s.caption}>{p.caption ?? p.room}</figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}

export function PhotoReportView({
  document: doc,
  photoSrc,
}: {
  document: PhotoReportDocument;
  photoSrc: (storagePath: string) => string;
}) {
  const date = fmtDate(doc.serviceDate);
  const locality = [doc.address, doc.city].filter(Boolean).join(", ");

  return (
    <article style={s.page}>
      <header style={s.header}>
        <div>
          <div style={s.wordmark}>{doc.provider.companyName}</div>
          {doc.provider.tagline ? <div style={s.tagline}>{doc.provider.tagline}</div> : null}
        </div>
        <div style={s.contact}>
          {doc.provider.phone ? <div>{doc.provider.phone}</div> : null}
          {doc.provider.email ? <div>{doc.provider.email}</div> : null}
          {doc.provider.website ? <div>{doc.provider.website}</div> : null}
        </div>
      </header>

      <h1 style={s.title}>{doc.serviceTitle}</h1>
      <div style={s.meta}>
        Prepared for <strong style={{ color: BRAND.navy }}>{doc.customerName}</strong>
        {date ? ` · ${date}` : ""}
        {doc.reference ? ` · Ref ${doc.reference}` : ""}
      </div>
      {doc.summary ? <div style={{ ...s.meta, marginTop: 4 }}>{doc.summary}</div> : null}
      {locality ? <div style={{ ...s.meta, marginTop: 2 }}>{locality}</div> : null}

      <div style={{ ...s.sectionLabel, background: "#8794a3" }}>Before</div>
      <PhotoGrid photos={doc.beforePhotos} photoSrc={photoSrc} emptyLabel="No before photos were captured." />

      <div style={{ ...s.sectionLabel, background: BRAND.blue }}>After</div>
      <PhotoGrid photos={doc.afterPhotos} photoSrc={photoSrc} emptyLabel="No after photos were captured." />

      <div style={s.thanks}>{doc.thankYou}</div>

      <footer style={s.footer}>
        {doc.provider.companyName}
        {doc.provider.website ? ` · ${doc.provider.website}` : ""}
      </footer>
    </article>
  );
}
