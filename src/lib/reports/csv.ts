/**
 * CSV export (BUILD_SPEC §G Phase 3 — "CSV/Excel export") — a PURE module.
 *
 * We export RFC-4180 CSV with a UTF-8 BOM so Microsoft Excel opens it directly
 * (double-click → opens as a spreadsheet, encoding intact). This is deliberately
 * chosen over a true .xlsx binary: it needs no dependency, has no security
 * surface, is trivially unit-testable, and Excel/Numbers/Sheets all import it
 * natively — consistent with the project's "lightest credible path" stance (the
 * same reasoning that picked @react-pdf over headless Chromium in Phase 2).
 */

export type CsvValue = string | number | boolean | null | undefined;

/** Quote a single cell when it contains a delimiter, quote, newline, or edge space. */
export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "string" ? value : String(value);
  const needsQuoting = /[",\r\n]/.test(s) || s !== s.trim();
  if (!needsQuoting) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

const BOM = "﻿";

/** Build a CSV document. CRLF line endings + a UTF-8 BOM by default (for Excel). */
export function toCsv(
  headers: CsvValue[],
  rows: CsvValue[][],
  opts: { bom?: boolean } = {},
): string {
  const { bom = true } = opts;
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(","));
  return (bom ? BOM : "") + lines.join("\r\n");
}
