/**
 * Branded proposal PDF (BUILD_SPEC §G / §C) — server-side, no browser.
 *
 * Rendered with @react-pdf/renderer (chosen per §D: pure-Node, Vercel-friendly,
 * no headless Chromium). Consumes a margin-free ProposalDocument, so the PDF
 * cannot contain internal economics (CLAUDE.md §3.5). Uses the primary stacked
 * brand logo + the §C palette. Body type is Helvetica (built-in) — registering
 * Montserrat TTFs is a later nicety; the logo carries the brand mark.
 *
 * Imported only by the PDF route handler + the render script (both server/Node);
 * `node:fs` (via brand-assets) keeps it out of any client bundle.
 */
import {
  Document,
  Image,
  Page,
  renderToBuffer,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { currency, currency0 } from "@/lib/format";
import { loadPrimaryLogo } from "./brand-assets";
import type { ProposalDocument, ProposalPriceSection } from "./types";

// Clear Horizon palette (§C).
const C = {
  navy: "#0D2B45",
  blue: "#1E6FB8",
  lightblue: "#7CC4F2",
  gold: "#FDB813",
  gray: "#F1F3F6",
  border: "#D4DCE5",
  muted: "#5B6B7B",
  white: "#FFFFFF",
};

const styles = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 56, paddingHorizontal: 44, fontSize: 10, color: C.navy, lineHeight: 1.4 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  logo: { width: 150 },
  headerContact: { textAlign: "right", fontSize: 8, color: C.muted, maxWidth: 200 },
  titleBar: { borderTopWidth: 2, borderTopColor: C.blue, paddingTop: 10, marginBottom: 14 },
  title: { fontSize: 18, fontWeight: 700, color: C.navy },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4, fontSize: 9, color: C.muted },

  twoCol: { flexDirection: "row", justifyContent: "space-between", gap: 16, marginBottom: 14 },
  panel: { flex: 1, backgroundColor: C.gray, borderRadius: 6, padding: 10 },
  panelLabel: { fontSize: 8, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 },
  strong: { fontWeight: 700 },

  sectionHeading: { fontSize: 12, fontWeight: 700, color: C.navy, marginTop: 10, marginBottom: 6 },

  priceCard: { borderWidth: 1, borderColor: C.border, borderRadius: 6, padding: 12, marginBottom: 10 },
  priceHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  priceTitle: { fontSize: 12, fontWeight: 700 },
  priceCaption: { fontSize: 9, color: C.muted },
  headlineWrap: { alignItems: "flex-end" },
  headlineLabel: { fontSize: 8, color: C.muted, textTransform: "uppercase", letterSpacing: 1 },
  headline: { fontSize: 20, fontWeight: 700, color: C.blue },
  lineRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 1.5 },
  lineMuted: { color: C.muted },
  divider: { borderTopWidth: 1, borderTopColor: C.border, marginVertical: 4 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 3, fontWeight: 700 },
  footnote: { fontSize: 8, color: C.muted, marginTop: 5 },

  scopeBlock: { marginBottom: 8 },
  scopeTitle: { fontSize: 11, fontWeight: 700, color: C.blue, marginBottom: 2 },
  scopeIntro: { fontSize: 9, color: C.muted, marginBottom: 4 },
  scopeArea: { fontSize: 9.5, fontWeight: 700, marginTop: 4 },
  task: { flexDirection: "row", paddingLeft: 8, paddingVertical: 0.5 },
  bullet: { width: 10, color: C.blue },

  termsHeading: { fontSize: 9.5, fontWeight: 700, marginTop: 6, marginBottom: 2 },
  termsBody: { fontSize: 8.5, color: C.navy, marginBottom: 2, textAlign: "justify" },

  approveBox: { borderWidth: 1, borderColor: C.gold, backgroundColor: "#FFF8E6", borderRadius: 6, padding: 10, marginTop: 10 },
  approveTitle: { fontSize: 11, fontWeight: 700, marginBottom: 3 },
  sigRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 14 },
  sigCell: { flex: 1, marginRight: 16 },
  sigLine: { borderTopWidth: 1, borderTopColor: C.navy, marginTop: 16, paddingTop: 2, fontSize: 8, color: C.muted },

  footer: {
    position: "absolute",
    bottom: 24,
    left: 44,
    right: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: C.muted,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 6,
  },
});

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function PriceCard({ section }: { section: ProposalPriceSection }) {
  return (
    <View style={styles.priceCard} wrap={false}>
      <View style={styles.priceHead}>
        <View>
          <Text style={styles.priceTitle}>{section.title}</Text>
          {section.caption ? <Text style={styles.priceCaption}>{section.caption}</Text> : null}
        </View>
        <View style={styles.headlineWrap}>
          <Text style={styles.headlineLabel}>{section.headlineLabel}</Text>
          <Text style={styles.headline}>{currency0(section.headline)}</Text>
        </View>
      </View>

      {section.lines.map((l, i) => (
        <View key={i} style={styles.lineRow}>
          <Text>
            {l.label}
            {l.detail ? <Text style={styles.lineMuted}> · {l.detail}</Text> : null}
          </Text>
          <Text>{currency(l.amount)}</Text>
        </View>
      ))}

      {section.subtotal !== undefined ? (
        <>
          <View style={styles.divider} />
          <View style={[styles.lineRow, styles.lineMuted]}>
            <Text>Subtotal</Text>
            <Text>{currency(section.subtotal)}</Text>
          </View>
        </>
      ) : null}
      {section.taxAmount !== undefined ? (
        <View style={[styles.lineRow, styles.lineMuted]}>
          <Text>{section.taxLabel ?? "Tax"}</Text>
          <Text>{currency(section.taxAmount)}</Text>
        </View>
      ) : null}
      <View style={styles.totalRow}>
        <Text>Total</Text>
        <Text>{currency(section.total)}</Text>
      </View>
      {section.footnote ? <Text style={styles.footnote}>{section.footnote}</Text> : null}
    </View>
  );
}

export function ProposalPdf({ document: doc }: { document: ProposalDocument }) {
  const logo = loadPrimaryLogo();
  const cust = doc.customer;
  const prov = doc.provider;
  const custLocality = [cust.city, cust.zip].filter(Boolean).join(", ");

  return (
    <Document
      title={`${doc.serviceTitle} — ${cust.name}`}
      author={prov.companyName}
      subject={`Proposal ${doc.reference}`}
    >
      <Page size="LETTER" style={styles.page}>
        {/* Header: logo + contact */}
        <View style={styles.header} fixed>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image style={styles.logo} src={{ data: logo, format: "png" }} />
          <View style={styles.headerContact}>
            <Text>{prov.companyName}</Text>
            {prov.phone ? <Text>{prov.phone}</Text> : null}
            {prov.email ? <Text>{prov.email}</Text> : null}
            {prov.website ? <Text>{prov.website}</Text> : null}
          </View>
        </View>

        {/* Title + meta */}
        <View style={styles.titleBar}>
          <Text style={styles.title}>{doc.serviceTitle}</Text>
          <View style={styles.metaRow}>
            <Text>Proposal {doc.reference}</Text>
            <Text>Issued {fmtDate(doc.issuedAt)} · Valid until {fmtDate(doc.expiresAt)}</Text>
          </View>
        </View>

        {/* Prepared for / property */}
        <View style={styles.twoCol}>
          <View style={styles.panel}>
            <Text style={styles.panelLabel}>Prepared for</Text>
            <Text style={styles.strong}>{cust.name}</Text>
            {cust.address ? <Text>{cust.address}</Text> : null}
            {custLocality ? <Text>{custLocality}</Text> : null}
            {cust.email ? <Text>{cust.email}</Text> : null}
            {cust.phone ? <Text>{cust.phone}</Text> : null}
          </View>
          <View style={styles.panel}>
            <Text style={styles.panelLabel}>Service</Text>
            <Text style={styles.strong}>{doc.category} cleaning</Text>
            {doc.summary ? <Text>{doc.summary}</Text> : null}
            {prov.tagline ? <Text style={{ color: C.muted, marginTop: 4 }}>{prov.tagline}</Text> : null}
          </View>
        </View>

        {/* Pricing */}
        <Text style={styles.sectionHeading}>Your quote</Text>
        {doc.prices.map((p) => (
          <PriceCard key={p.key} section={p} />
        ))}
        {doc.notes ? <Text style={styles.footnote}>Notes: {doc.notes}</Text> : null}

        {/* Scope of work */}
        <Text style={styles.sectionHeading}>What&apos;s included</Text>
        {doc.scope.map((list) => (
          <View key={list.key} style={styles.scopeBlock} wrap={false}>
            <Text style={styles.scopeTitle}>{list.title}</Text>
            {list.intro ? <Text style={styles.scopeIntro}>{list.intro}</Text> : null}
            {list.sections.map((s, i) => (
              <View key={i}>
                <Text style={styles.scopeArea}>{s.area}</Text>
                {s.tasks.map((t, j) => (
                  <View key={j} style={styles.task}>
                    <Text style={styles.bullet}>•</Text>
                    <Text>{t}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        ))}

        {/* Footer on every page */}
        <View style={styles.footer} fixed>
          <Text>{prov.tagline ?? prov.companyName}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      {/* Terms & acceptance on their own page(s) */}
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header} fixed>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image style={styles.logo} src={{ data: logo, format: "png" }} />
          <View style={styles.headerContact}>
            <Text>Proposal {doc.reference}</Text>
            <Text>Valid until {fmtDate(doc.expiresAt)}</Text>
          </View>
        </View>

        <Text style={styles.sectionHeading}>Terms &amp; Conditions</Text>
        {doc.terms.map((t, i) => (
          <View key={i} wrap={false}>
            <Text style={styles.termsHeading}>{t.heading}</Text>
            {t.body.map((p, j) => (
              <Text key={j} style={styles.termsBody}>
                {p}
              </Text>
            ))}
          </View>
        ))}

        <View style={styles.approveBox} wrap={false}>
          <Text style={styles.approveTitle}>Acceptance</Text>
          <Text style={{ fontSize: 9 }}>
            To accept this proposal, approve it online using the secure link provided by{" "}
            {prov.companyName} (electronic &quot;I agree&quot; + your typed name is recorded as your
            signature), or sign below. This proposal is valid until {fmtDate(doc.expiresAt)}.
          </Text>
          <View style={styles.sigRow}>
            <View style={styles.sigCell}>
              <Text style={styles.sigLine}>Customer signature</Text>
            </View>
            <View style={styles.sigCell}>
              <Text style={styles.sigLine}>Printed name</Text>
            </View>
            <View style={[styles.sigCell, { marginRight: 0 }]}>
              <Text style={styles.sigLine}>Date</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text>{prov.tagline ?? prov.companyName}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

/** Render a proposal document to a PDF Buffer (used by the route + render script). */
export function renderProposalPdf(doc: ProposalDocument): Promise<Buffer> {
  return renderToBuffer(<ProposalPdf document={doc} />);
}
