/**
 * Brand asset loader for server-side PDF generation.
 *
 * Reads the primary stacked logo (BUILD_SPEC §C: "primary stacked logo on PDF
 * proposals") from /public/brand into a Buffer for @react-pdf/renderer's
 * <Image src={{ data, format }} />. Uses `node:fs` (not an import of the PNG) so
 * it works in a Vercel serverless function; next.config.ts traces the file in.
 *
 * Importing `node:fs` here means this module — like the PDF renderer that uses
 * it — is server-only by construction (it cannot bundle into a client).
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const PRIMARY_LOGO_RELATIVE = path.join("public", "brand", "01_primary_logo_2.png");

let cachedLogo: Buffer | null = null;

/** The primary stacked logo PNG as a Buffer (cached for the process lifetime). */
export function loadPrimaryLogo(): Buffer {
  if (!cachedLogo) {
    cachedLogo = readFileSync(path.join(process.cwd(), PRIMARY_LOGO_RELATIVE));
  }
  return cachedLogo;
}
