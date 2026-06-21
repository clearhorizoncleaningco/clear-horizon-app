import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/dal";
import { getCalibrationData, type CalibrationItem } from "@/lib/calibration/service";
import type { BandStatus } from "@/lib/calibration/compute";
import { currency, percent } from "@/lib/format";
import { CalibrationForm } from "@/components/jobs/calibration-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Calibration" };

const dec = (d: { toNumber(): number } | null): number | null => (d == null ? null : d.toNumber());

const BAND_STYLES: Record<BandStatus, { label: string; cls: string }> = {
  under: { label: "Rich (labor < target)", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300" },
  in: { label: "On target", cls: "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300" },
  over: { label: "Thin (labor > target)", cls: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300" },
};

export default async function CalibrationPage() {
  const { profile } = await requireProfile();
  if (!profile) return null;
  // Calibration surfaces internal margin/labor — Admin only (CLAUDE.md §3.5).
  if (profile.role !== "Admin") redirect("/dashboard");

  const { items, summary, margin } = await getCalibrationData(profile.organizationId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Calibration</h1>
        <p className="text-muted-foreground">
          Log what actually happened on each job — the engine learns from it. Target labor is{" "}
          <strong>{percent(margin.targetLaborPct, 0)}</strong> of price (band {percent(margin.laborBandMin, 0)}–
          {percent(margin.laborBandMax, 0)}). Admin-only.
        </p>
      </div>

      {/* Portfolio summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Avg actual labor %"
          value={summary.avgActualLaborPct != null ? percent(summary.avgActualLaborPct, 1) : "—"}
          hint={`target ${percent(summary.targetLaborPct, 0)}`}
        />
        <SummaryCard
          label="Avg actual margin %"
          value={summary.avgActualMarginPct != null ? percent(summary.avgActualMarginPct, 1) : "—"}
          hint={`${summary.jobsWithActuals} jobs logged`}
        />
        <SummaryCard
          label="On target / rich / thin"
          value={`${summary.inBandCount} / ${summary.underBandCount} / ${summary.overBandCount}`}
          hint="jobs by labor band"
        />
        <SummaryCard
          label="Avg price variance"
          value={summary.avgPriceVariance != null ? currency(summary.avgPriceVariance) : "—"}
          hint="charged − quoted"
        />
      </div>

      {/* Per-job calibration */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Jobs</CardTitle>
          <CardDescription>
            Expand a job to log price charged, crew hours and labor $. Realised labor % is compared to target.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">
              No jobs yet. Convert an estimate to a job (from an estimate&apos;s page) to start logging actuals.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <JobRow key={item.job.id} item={item} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function JobRow({ item }: { item: CalibrationItem }) {
  const { job, calibration: c } = item;
  const band = c.bandStatus ? BAND_STYLES[c.bandStatus] : null;

  return (
    <li className="px-6 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link href={`/jobs/${job.id}`} className="font-medium hover:underline">
              {job.customerName ?? job.customer?.name ?? "Job"}
            </Link>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
              {job.status}
            </span>
            {band ? <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${band.cls}`}>{band.label}</span> : null}
          </div>
          <div className="text-sm text-muted-foreground">{job.summary ?? job.category}</div>
        </div>
        <div className="text-right text-sm">
          <div className="text-muted-foreground">Quoted {currency(dec(job.quotedPrice) ?? 0)}</div>
          {c.hasActuals ? (
            <div className="font-semibold tabular-nums">
              Labor {c.actualLaborPct != null ? percent(c.actualLaborPct, 1) : "—"} · Margin{" "}
              {c.actualMarginPct != null ? percent(c.actualMarginPct, 1) : "—"}
            </div>
          ) : (
            <div className="text-muted-foreground">No actuals yet</div>
          )}
        </div>
      </div>

      {c.hasActuals ? (
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-4">
          <span>Charged: {c.priceCharged != null ? currency(c.priceCharged) : "—"}</span>
          <span>Crew hrs: {c.actualCrewHours ?? "—"}</span>
          <span>Labor $: {c.actualLaborCost != null ? currency(c.actualLaborCost) : "—"}</span>
          <span>Total cost: {c.actualTotalCost != null ? currency(c.actualTotalCost) : "—"}</span>
          <span>Price var: {c.priceVariance != null ? currency(c.priceVariance) : "—"}</span>
          <span>Hours var: {c.hoursVariance ?? "—"}</span>
          <span>Labor var: {c.laborCostVariance != null ? currency(c.laborCostVariance) : "—"}</span>
        </div>
      ) : null}

      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-medium text-primary">
          {c.hasActuals ? "Edit actuals" : "Log actuals"}
        </summary>
        <div className="mt-3 rounded-lg border border-border p-4">
          <CalibrationForm
            defaults={{
              jobId: job.id,
              priceCharged: dec(job.priceCharged),
              actualCrewHours: dec(job.actualCrewHours),
              actualLaborCost: dec(job.actualLaborCost),
              actualSuppliesCost: dec(job.actualSuppliesCost),
              cleanerPayAmount: dec(job.cleanerPayAmount),
              calibrationNotes: job.calibrationNotes,
            }}
          />
        </div>
      </details>
    </li>
  );
}
