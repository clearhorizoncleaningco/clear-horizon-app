"use client";

import type { QuoteLine, ResidentialQuoteResult } from "@/lib/pricing";
import { currency, currency0, hoursLabel, multiplier, percent } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function Row({
  label,
  value,
  strong,
  muted,
  indent,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  strong?: boolean;
  muted?: boolean;
  indent?: boolean;
}) {
  return (
    <div
      className={[
        "flex items-baseline justify-between gap-4 py-1.5 text-sm",
        strong ? "font-semibold" : "",
        muted ? "text-muted-foreground" : "",
        indent ? "pl-4" : "",
      ].join(" ")}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

const Divider = () => <div className="my-1 border-t border-border" />;

/** Full step-by-step breakdown for a single priced visit line (§E.1 Steps 1–21). */
function LineBreakdown({ line }: { line: QuoteLine }) {
  return (
    <div className="flex flex-col">
      <p className="pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Labor hours</p>
      <Row label="Base (square footage)" value={hoursLabel(line.baseLaborHours)} />
      {line.bathroomHours > 0 && <Row label="+ Bathrooms" value={hoursLabel(line.bathroomHours)} muted indent />}
      {line.bedroomHours > 0 && <Row label="+ Bedrooms" value={hoursLabel(line.bedroomHours)} muted indent />}
      {line.petHours > 0 && <Row label="+ Pets" value={hoursLabel(line.petHours)} muted indent />}
      {line.featureLines.map((f) => (
        <Row key={f.key} label={`+ ${f.label}`} value={hoursLabel(f.hours)} muted indent />
      ))}
      <Row label="Labor hours" value={hoursLabel(line.laborHours)} strong />

      <Divider />
      <p className="py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Production hours
      </p>
      <Row label="Occupancy" value={multiplier(line.occupancyMultiplier)} muted />
      <Row label="Flooring" value={multiplier(line.flooringMultiplier)} muted />
      <Row label="Condition" value={multiplier(line.conditionMultiplier)} muted />
      {line.deepCleanPremium !== null && (
        <Row label="Deep-clean premium (reconciled)" value={multiplier(line.deepCleanPremium)} muted />
      )}
      <Row label="Production hours" value={hoursLabel(line.productionHours)} strong />

      <Divider />
      <p className="py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Price</p>
      <Row label="Hourly rate" value={currency(line.hourlyRate)} muted />
      <Row label="Frequency" value={multiplier(line.frequencyMultiplier)} muted />
      <Row label="Seasonal" value={multiplier(line.seasonalMultiplier)} muted />
      <Row label="Base price" value={currency(line.basePrice)} />
      {line.travelFee > 0 && <Row label={`Travel (${line.travelMiles} mi)`} value={currency(line.travelFee)} />}
      {line.travelManualReview && (
        <Row label="Travel" value={<span className="text-brand-gold">Manual review (30+ mi)</span>} />
      )}
      {line.addOnLines.map((a) => (
        <Row
          key={a.key}
          label={`${a.label}${a.unit === "PerUnit" ? ` ×${a.quantity}` : ""}`}
          value={currency(a.lineTotal)}
          indent
        />
      ))}
      {line.addOnsTotal > 0 && <Row label="Add-ons subtotal" value={currency(line.addOnsTotal)} muted />}
      <Divider />
      <Row label="Subtotal" value={currency(line.subtotal)} />
      {line.minimumApplied && (
        <Row
          label={<span className="text-brand-gold">Minimum charge applied</span>}
          value={currency(line.minimumCharge)}
        />
      )}
      <Row label="Rounded (pre-tax)" value={currency0(line.preTaxPrice)} strong />
      {line.taxable && (
        <Row label={`Tax (${percent(line.taxRate)})`} value={currency(line.taxAmount)} />
      )}
      <Row label="Total" value={currency(line.total)} strong />
    </div>
  );
}

/** §E.6 — ADMIN-ONLY margin panel. Caller must gate on isAdmin. */
function MarginPanel({ line }: { line: QuoteLine }) {
  const m = line.margin;
  return (
    <Card className="border-brand-gold/50 bg-brand-gold/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          Margin (Admin only)
          {m.outOfBand ? (
            <span className="rounded-full bg-brand-gold px-2 py-0.5 text-xs font-semibold text-brand-navy">
              Labor {percent(m.laborPct)} — outside {percent(m.laborBandMin, 0)}–{percent(m.laborBandMax, 0)} band
            </span>
          ) : (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
              Labor {percent(m.laborPct)} — in band
            </span>
          )}
        </CardTitle>
        <CardDescription>Never shown to Office Staff or customers.</CardDescription>
      </CardHeader>
      <CardContent>
        <Row label="Estimated labor cost" value={currency(m.estimatedLaborCost)} />
        <Row label={`Labor rate (${currency(m.laborCostPerHour)}/hr × ${hoursLabel(line.productionHours)} hrs)`} value="" muted />
        <Row label="Supplies" value={currency(m.suppliesPerVisit)} />
        <Row label="Total cost" value={currency(m.totalCost)} />
        <Divider />
        <Row label="Projected margin" value={`${currency(m.projectedMargin)} (${percent(m.marginPct)})`} strong />
        <Row label="Target labor %" value={percent(m.targetLaborPct, 0)} muted />
      </CardContent>
    </Card>
  );
}

export function QuoteResults({
  result,
  isAdmin,
}: {
  result: ResidentialQuoteResult;
  isAdmin: boolean;
}) {
  const { primary, initialDeepClean, isRecurring, projectedMonthly, visitsPerMonth, marketTier, seasonal } = result;

  return (
    <div className="flex flex-col gap-6">
      {/* Headline prices */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-primary/40">
          <CardHeader className="pb-2">
            <CardDescription>{isRecurring ? `Per visit · ${primary.frequencyLabel}` : primary.frequencyLabel}</CardDescription>
            <CardTitle className="text-4xl text-primary">{currency0(primary.preTaxPrice)}</CardTitle>
          </CardHeader>
          <CardContent>
            {isRecurring && projectedMonthly !== null ? (
              <p className="text-sm text-muted-foreground">
                Projected monthly: <span className="font-semibold text-foreground">{currency(projectedMonthly)}</span>{" "}
                ({visitsPerMonth} visits/mo)
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">One-time service</p>
            )}
          </CardContent>
        </Card>

        {isRecurring && initialDeepClean ? (
          <Card className="border-brand-gold/50">
            <CardHeader className="pb-2">
              <CardDescription>Initial deep clean · one-time (first visit)</CardDescription>
              <CardTitle className="text-4xl">{currency0(initialDeepClean.preTaxPrice)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Charged once before recurring service begins. Priced with the deep-clean premium.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-muted/40">
            <CardHeader className="pb-2">
              <CardDescription>Market tier · {marketTier.source}</CardDescription>
              <CardTitle className="text-2xl">{marketTier.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {currency(marketTier.hourlyRate)}/hr · min {currency0(marketTier.minimumCharge)} ·{" "}
                {seasonal.isPeak ? "Peak season" : "Off-season"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Breakdown(s) */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{isRecurring ? "Recurring per-visit breakdown" : "Quote breakdown"}</CardTitle>
            <CardDescription>
              {marketTier.label} · {currency(marketTier.hourlyRate)}/hr · {seasonal.isPeak ? "peak" : "off"}-season
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LineBreakdown line={primary} />
          </CardContent>
        </Card>

        {isRecurring && initialDeepClean && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Initial deep-clean breakdown</CardTitle>
              <CardDescription>One-time, charged for the first visit</CardDescription>
            </CardHeader>
            <CardContent>
              <LineBreakdown line={initialDeepClean} />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Admin-only margin (§E.6 / CLAUDE.md §3.5) */}
      {isAdmin && (
        <div className="grid gap-4 lg:grid-cols-2">
          <MarginPanel line={primary} />
          {isRecurring && initialDeepClean && <MarginPanel line={initialDeepClean} />}
        </div>
      )}
    </div>
  );
}
