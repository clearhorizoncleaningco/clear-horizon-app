import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/dal";
import { getReportData } from "@/lib/reports/service";
import { currency, currency0, percent } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Reports" };

function ExportButton({ type, label = "Export CSV" }: { type: string; label?: string }) {
  return (
    <a
      href={`/api/reports/export?type=${type}`}
      className={buttonVariants({ variant: "outline", size: "sm" })}
    >
      {label}
    </a>
  );
}

export default async function ReportsPage() {
  const { profile } = await requireProfile();
  if (!profile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Account not provisioned</CardTitle>
          <CardDescription>Ask an admin to run the seed/invite step.</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  if (profile.role === "Cleaner") redirect("/cleaner");

  const data = await getReportData(profile.organizationId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">
          {data.totalEstimates} estimates · export any table to CSV (opens in Excel, Numbers or Sheets).
        </p>
      </div>

      {/* Conversion */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Conversion</CardTitle>
            <CardDescription>Quote → proposal → approval funnel.</CardDescription>
          </div>
          <ExportButton type="conversion" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Metric label="Total" value={String(data.conversion.total)} />
            <Metric label="Saved" value={String(data.conversion.saved)} />
            <Metric label="Proposed" value={String(data.conversion.proposed)} />
            <Metric label="Approved" value={String(data.conversion.approved)} />
            <Metric label="Declined" value={String(data.conversion.declined)} />
            <Metric
              label="Conversion"
              value={data.conversion.proposedPlus > 0 ? percent(data.conversion.conversionRate, 0) : "—"}
            />
          </div>
        </CardContent>
      </Card>

      {/* Revenue projection */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Revenue projection</CardTitle>
            <CardDescription>Recurring estimates → projected monthly book.</CardDescription>
          </div>
          <ExportButton type="revenue-projection" />
        </CardHeader>
        <CardContent>
          <Table
            head={["Customer", "Frequency", "Per visit", "Projected / mo"]}
            rows={data.revenueProjection.rows.slice(0, 12).map((r) => [
              r.customer,
              r.frequency,
              currency(r.perVisit),
              currency(r.projectedMonthly),
            ])}
            alignRight={[2, 3]}
          />
          <div className="mt-3 flex justify-between border-t border-border pt-3 text-sm font-semibold">
            <span>Total projected monthly · annualized</span>
            <span className="tabular-nums">
              {currency0(data.revenueProjection.totalMonthly)} · {currency0(data.revenueProjection.totalAnnual)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Estimates by month */}
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Estimates by month</CardTitle>
            <CardDescription>Volume + headline value by period.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <ExportButton type="estimates-daily" label="Daily CSV" />
            <ExportButton type="estimates-weekly" label="Weekly CSV" />
            <ExportButton type="estimates-monthly" label="Monthly CSV" />
          </div>
        </CardHeader>
        <CardContent>
          <Table
            head={["Month", "Estimates", "Headline value"]}
            rows={data.byMonth.map((r) => [r.label, String(r.count), currency0(r.totalValue)])}
            alignRight={[1, 2]}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top cities */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Top cities / tiers</CardTitle>
            </div>
            <ExportButton type="top-cities" />
          </CardHeader>
          <CardContent>
            <Table
              head={["City / tier", "Estimates", "Value"]}
              rows={data.cities.map((c) => [c.city, String(c.count), currency0(c.totalValue)])}
              alignRight={[1, 2]}
            />
          </CardContent>
        </Card>

        {/* Average ticket */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Average ticket</CardTitle>
            </div>
            <ExportButton type="avg-ticket" />
          </CardHeader>
          <CardContent>
            <Table
              head={["Segment", "Count", "Avg headline", "Avg total"]}
              rows={data.avgTicket.map((r) => [r.segment, String(r.count), currency(r.avgHeadline), currency(r.avgTotal)])}
              alignRight={[1, 2, 3]}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function Table({
  head,
  rows,
  alignRight = [],
}: {
  head: string[];
  rows: string[][];
  alignRight?: number[];
}) {
  const right = new Set(alignRight);
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No data yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            {head.map((h, i) => (
              <th key={i} className={`pb-2 font-medium ${right.has(i) ? "text-right" : ""}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/50 last:border-0">
              {row.map((cell, j) => (
                <td key={j} className={`py-2 ${right.has(j) ? "text-right tabular-nums" : ""}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
