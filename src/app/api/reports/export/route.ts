import type { NextRequest } from "next/server";
import { getCurrentProfile } from "@/lib/auth/dal";
import { buildReportCsv, getReportRows, isReportType } from "@/lib/reports/service";

/**
 * CSV export for the Phase 3 reports (BUILD_SPEC §G — "CSV/Excel export").
 * Org-scoped + auth-gated (this /api route is outside the proxy matcher, so it
 * re-verifies the session via the DAL). `?type=` selects the report.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const result = await getCurrentProfile();
  if (!result?.profile) return new Response("Unauthorized", { status: 401 });

  const type = new URL(request.url).searchParams.get("type") ?? "";
  if (!isReportType(type)) return new Response("Unknown report type", { status: 400 });

  const rows = await getReportRows(result.profile.organizationId);
  const { filename, csv } = buildReportCsv(type, rows);

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
