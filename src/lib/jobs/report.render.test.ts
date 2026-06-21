import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildPhotoReport } from "./report";
import { PhotoReportView } from "@/components/jobs/photo-report-view";

/**
 * Phase 3 §G checkpoint — "a customer photo report is generated." Renders the
 * real <PhotoReportView> for a completed job with before/after photos to static
 * HTML, asserts the markup carries the photos and customer but NO internal
 * economics, and writes tmp/sample-report.html (real brand images via file://
 * URLs so it opens correctly). Run on its own with `npm run verify:report`.
 */
const provider = {
  companyName: "Clear Horizon Cleaning Co.",
  tagline: "Clean Spaces. Better Places.",
  email: "admin@clearhorizoncleaners.com",
  phone: "(239) 396-5740",
  website: "https://www.clearhorizoncleaners.com",
};

// Demo "photos" reuse brand PNGs as visible stand-ins for before/after shots.
const doc = buildPhotoReport({
  reference: "CH-JOB-AB12CD34",
  customerName: "Jane Doe",
  summary: "2,200 sq ft · 3 bd / 2.5 ba · Naples · biweekly",
  completedAt: new Date("2026-06-21T15:00:00.000Z"),
  address: "123 Gulf Shore Blvd",
  city: "Naples",
  provider,
  photos: [
    { kind: "Before", storagePath: "/brand/04_alt_stacked_1.png", caption: "Kitchen — before", room: "Kitchen", sortOrder: 0 },
    { kind: "Before", storagePath: "/brand/brandmark_icon_exact_2.png", caption: "Primary bath — before", room: "Bath", sortOrder: 1 },
    { kind: "After", storagePath: "/brand/05_alt_circular_badge_3.png", caption: "Kitchen — after", room: "Kitchen", sortOrder: 0 },
    { kind: "After", storagePath: "/brand/facebook_profile_1080x1080_3.png", caption: "Primary bath — after", room: "Bath", sortOrder: 1 },
  ],
});

/** Resolve a /public path to a file:// URL so the saved HTML shows the images. */
function localPhotoSrc(storagePath: string): string {
  const rel = storagePath.replace(/^\//, "");
  return pathToFileURL(path.join(process.cwd(), "public", rel)).href;
}

describe("customer photo report renders", () => {
  it("renders before/after photos + customer, leaks no economics, writes tmp/sample-report.html", () => {
    const html = renderToStaticMarkup(
      createElement(PhotoReportView, { document: doc, photoSrc: localPhotoSrc }),
    );

    // Renders the substance.
    expect(html).toContain("Jane Doe");
    expect(html).toContain("Before");
    expect(html).toContain("After");
    expect(html).toContain("Kitchen — before");
    expect(html).toContain("Kitchen — after");
    expect(html).toContain("Clear Horizon Cleaning Co.");
    // Two before + two after <img> = four images.
    expect((html.match(/<img\b/g) ?? []).length).toBe(4);

    // Render-level firewall: no internal economics in the VISIBLE content.
    // (Strip inline style attributes first so CSS keywords like the `margin`
    // property aren't false positives — the structural firewall on the document
    // itself is asserted in report.test.ts.)
    const visible = html.replace(/ style="[^"]*"/g, "").toLowerCase();
    for (const banned of ["margin", "labor", "cost", "$", "quoted"]) {
      expect(visible).not.toContain(banned);
    }

    const out = path.join(process.cwd(), "tmp", "sample-report.html");
    mkdirSync(path.dirname(out), { recursive: true });
    const fullPage = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Your Clean — Clear Horizon</title></head><body style="margin:0;background:#eef2f6">${html}</body></html>`;
    writeFileSync(out, fullPage, "utf8");
    console.log(`[verify:report] wrote ${out} — ${fullPage.length} bytes, 4 photos`);
  });
});
