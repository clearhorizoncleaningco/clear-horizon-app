import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  addZipMapping,
  deleteZipMapping,
  updateAddOns,
  updateFrequencies,
  updateHours,
  updateMarginConfig,
  updateMarketTiers,
  updateMultipliers,
  updateOrgDefaults,
  updatePricingSettings,
  updateSqftTiers,
  updateTaxRates,
  updateTravelBrackets,
  updateZipMappings,
} from "./actions";

export const metadata: Metadata = { title: "Pricing settings" };

type DecimalLike = { toNumber(): number };
const n = (d: DecimalLike): number => d.toNumber();
const nOrEmpty = (d: DecimalLike | null): string => (d === null ? "" : String(d.toNumber()));

// ---------------------------------------------------------------------------
// Reusable section form for numeric/string tables. Inputs are named
// `${prefix}${rowId}` so the matching server action can read them back.
// ---------------------------------------------------------------------------
interface Col {
  header: string;
  prefix: string;
  value: number | string;
  type?: string;
  step?: string;
}
interface SectionRow {
  id: string;
  label: string;
  cols: Col[];
}

function SectionForm({
  action,
  title,
  description,
  rows,
  hidden,
}: {
  action: (formData: FormData) => Promise<void>;
  title: string;
  description?: string;
  rows: SectionRow[];
  hidden?: Record<string, string>;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-2">
          {hidden
            ? Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)
            : null}
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 border-b border-border/60 pb-2 last:border-0">
              <span className="text-sm">{r.label}</span>
              <div className="flex items-end gap-2">
                {r.cols.map((c) => (
                  <label key={c.prefix} className="flex flex-col gap-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {c.header}
                    <Input
                      name={`${c.prefix}${r.id}`}
                      defaultValue={String(c.value)}
                      type={c.type ?? "number"}
                      step={c.step ?? "0.01"}
                      className="h-9 w-28"
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
          <div className="pt-2">
            <Button type="submit" size="sm">Save</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default async function PricingSettingsPage() {
  const { user, profile } = await requireProfile();

  if (!profile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Account not provisioned</CardTitle>
          <CardDescription>Signed in as {user.email}, but not linked to an organization.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (profile.role !== "Admin") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Admins only</CardTitle>
          <CardDescription>
            Pricing and margin settings are restricted to Admins (CLAUDE.md §3.5). You&apos;re signed in as{" "}
            {profile.role}.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const orgId = profile.organizationId;
  const where = { organizationId: orgId };
  const bySort = { sortOrder: "asc" as const };

  const [
    org,
    sqftTiers,
    bedrooms,
    pets,
    features,
    occupancy,
    flooring,
    condition,
    frequencies,
    marketTiers,
    zips,
    addOns,
    travel,
    taxRates,
    properties,
    settings,
    margin,
  ] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId } }),
    prisma.sqftLaborTier.findMany({ where, orderBy: bySort }),
    prisma.bedroomAdjustment.findMany({ where, orderBy: bySort }),
    prisma.petAdjustment.findMany({ where, orderBy: bySort }),
    prisma.featureOption.findMany({ where, orderBy: bySort }),
    prisma.occupancyMultiplier.findMany({ where, orderBy: bySort }),
    prisma.flooringMultiplier.findMany({ where, orderBy: bySort }),
    prisma.conditionMultiplier.findMany({ where, orderBy: bySort }),
    prisma.frequencyMultiplier.findMany({ where, orderBy: bySort }),
    prisma.marketTier.findMany({ where, orderBy: bySort }),
    prisma.zipTierMapping.findMany({ where, orderBy: { zip: "asc" } }),
    prisma.addOn.findMany({ where, orderBy: bySort }),
    prisma.travelBracket.findMany({ where, orderBy: bySort }),
    prisma.taxRate.findMany({ where }),
    prisma.propertyType.findMany({ where, orderBy: bySort }),
    prisma.pricingSetting.findMany({ where, orderBy: { key: "asc" } }),
    prisma.marginConfig.findUnique({ where: { organizationId: orgId } }),
  ]);

  const tierLabel = (key: string) => marketTiers.find((t) => t.key === key)?.label ?? key;
  const sqftLabel = (minSqft: number, maxSqft: number | null) =>
    maxSqft === null ? `${minSqft}+ sq ft` : `${minSqft}–${maxSqft} sq ft`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Pricing settings</h1>
        <p className="text-muted-foreground">
          {profile.organization.name} · every rate, multiplier, threshold &amp; fee is editable here (BUILD_SPEC §E).
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Market tiers */}
        <SectionForm
          action={updateMarketTiers}
          title="Market tiers — rate & minimum (§E.3)"
          description="Naples $85/hr is locked by the §5 fixture; Fort Myers & Luxury Naples are owner-confirmed."
          rows={marketTiers.map((t) => ({
            id: t.id,
            label: t.label,
            cols: [
              { header: "$/hr", prefix: "rate_", value: n(t.hourlyRate) },
              { header: "Min $", prefix: "min_", value: n(t.minimumCharge) },
            ],
          }))}
        />

        {/* Margin (Admin-only) */}
        <Card className="border-brand-gold/50 bg-brand-gold/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Internal margin (§E.6 — Admin only)</CardTitle>
            <CardDescription>Never shown to staff or customers. Percentages are decimals (0.5 = 50%).</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateMarginConfig} className="grid gap-3 sm:grid-cols-2">
              <LabeledInput name="laborCostPerHour" label="Labor cost / crew-hour ($)" value={margin ? n(margin.laborCostPerHour) : 22} />
              <LabeledInput name="suppliesPerVisit" label="Supplies / visit ($)" value={margin ? n(margin.suppliesPerVisit) : 10} />
              <LabeledInput name="targetLaborPct" label="Target labor %" value={margin ? n(margin.targetLaborPct) : 0.5} step="0.01" />
              <LabeledInput name="laborBandMin" label="Labor band min" value={margin ? n(margin.laborBandMin) : 0.4} step="0.01" />
              <LabeledInput name="laborBandMax" label="Labor band max" value={margin ? n(margin.laborBandMax) : 0.6} step="0.01" />
              <div className="flex items-end">
                <Button type="submit" size="sm">Save</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Sqft labor tiers */}
        <SectionForm
          action={updateSqftTiers}
          title="Base labor hours by sqft (§E.1 Step 1)"
          rows={sqftTiers.map((t) => ({
            id: t.id,
            label: sqftLabel(t.minSqft, t.maxSqft),
            cols:
              t.maxSqft === null
                ? [
                    { header: "Base hrs", prefix: "base_", value: n(t.baseHours), step: "0.05" },
                    { header: "Step hrs/500", prefix: "step_", value: nOrEmpty(t.stepHours), step: "0.05" },
                  ]
                : [{ header: "Base hrs", prefix: "base_", value: n(t.baseHours), step: "0.05" }],
          }))}
        />

        {/* Frequencies */}
        <SectionForm
          action={updateFrequencies}
          title="Frequency multipliers (§E.1 Step 13 / §E.2)"
          description="Visits/month feeds the projected-monthly figure; leave blank for one-time services."
          rows={frequencies.map((f) => ({
            id: f.id,
            label: f.label,
            cols: [
              { header: "×", prefix: "mult_", value: n(f.multiplier), step: "0.05" },
              { header: "Visits/mo", prefix: "vpm_", value: nOrEmpty(f.visitsPerMonth), step: "0.01" },
            ],
          }))}
        />

        {/* Multiplier tables */}
        <SectionForm
          action={updateMultipliers}
          title="Occupancy multipliers (§E.1 Step 7)"
          hidden={{ model: "occupancy" }}
          rows={occupancy.map((o) => ({ id: o.id, label: o.label, cols: [{ header: "×", prefix: "m_", value: n(o.multiplier), step: "0.01" }] }))}
        />
        <SectionForm
          action={updateMultipliers}
          title="Flooring multipliers (§E.1 Step 8)"
          hidden={{ model: "flooring" }}
          rows={flooring.map((o) => ({ id: o.id, label: o.label, cols: [{ header: "×", prefix: "m_", value: n(o.multiplier), step: "0.01" }] }))}
        />
        <SectionForm
          action={updateMultipliers}
          title="Condition multipliers (§E.1 Step 9)"
          hidden={{ model: "condition" }}
          rows={condition.map((o) => ({ id: o.id, label: o.label, cols: [{ header: "×", prefix: "m_", value: n(o.multiplier), step: "0.01" }] }))}
        />
        <SectionForm
          action={updateMultipliers}
          title="Property type multipliers (§E.7 — captured, not applied in v1)"
          hidden={{ model: "property" }}
          rows={properties.map((o) => ({ id: o.id, label: o.label, cols: [{ header: "×", prefix: "m_", value: n(o.multiplier), step: "0.01" }] }))}
        />

        {/* Hours tables */}
        <SectionForm
          action={updateHours}
          title="Pet adjustments (§E.1 Step 4)"
          hidden={{ model: "pet" }}
          rows={pets.map((p) => ({ id: p.id, label: p.label, cols: [{ header: "+ hrs", prefix: "h_", value: n(p.hours), step: "0.05" }] }))}
        />
        <SectionForm
          action={updateHours}
          title="Feature hours (§E.1 Step 5)"
          hidden={{ model: "feature" }}
          rows={features.map((f) => ({ id: f.id, label: f.label, cols: [{ header: "+ hrs", prefix: "h_", value: n(f.hours), step: "0.05" }] }))}
        />
        <SectionForm
          action={updateHours}
          title="Bedroom adjustments (§E.1 Step 3)"
          hidden={{ model: "bedroom" }}
          rows={bedrooms.map((b) => ({
            id: b.id,
            label: b.maxBeds === null ? `${b.minBeds}+ beds` : b.minBeds === b.maxBeds ? `${b.minBeds} beds` : `${b.minBeds}–${b.maxBeds} beds`,
            cols: [{ header: "+ hrs", prefix: "h_", value: n(b.hours), step: "0.05" }],
          }))}
        />

        {/* Add-ons */}
        <SectionForm
          action={updateAddOns}
          title="Add-on prices (§E.1 Step 17)"
          rows={addOns.map((a) => ({
            id: a.id,
            label: `${a.label}${a.unit === "PerUnit" ? " (per unit)" : ""}`,
            cols: [{ header: "$", prefix: "price_", value: n(a.price) }],
          }))}
        />

        {/* Travel */}
        <SectionForm
          action={updateTravelBrackets}
          title="Travel brackets (§E.1 Step 16)"
          rows={travel.map((t) => ({
            id: t.id,
            label: t.maxMiles === null ? `${t.minMiles}+ mi${t.requiresManualReview ? " (manual review)" : ""}` : `${t.minMiles}–${t.maxMiles} mi`,
            cols: [{ header: "Fee $", prefix: "fee_", value: n(t.fee) }],
          }))}
        />

        {/* Tax */}
        <SectionForm
          action={updateTaxRates}
          title="Tax rates (§E.5)"
          description="Decimal rate (0.06 = 6%). Residential is non-taxable; commercial is taxable."
          rows={taxRates.map((t) => ({
            id: t.id,
            label: `${t.jurisdiction}${t.isDefault ? " (default)" : ""}`,
            cols: [{ header: "Rate", prefix: "rate_", value: n(t.rate), step: "0.0001" }],
          }))}
        />

        {/* Scalar settings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Engine knobs (§E.1/§E.10/§E.14/§E.21)</CardTitle>
            <CardDescription>Bathroom rule, intensity reconciliation, seasonal &amp; rounding.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updatePricingSettings} className="flex flex-col gap-2">
              {settings.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 border-b border-border/60 pb-2 last:border-0">
                  <label htmlFor={`val_${s.id}`} className="text-sm" title={s.description ?? undefined}>
                    {s.key}
                  </label>
                  <input type="hidden" name={`type_${s.id}`} value={s.valueType} />
                  <Input id={`val_${s.id}`} name={`val_${s.id}`} defaultValue={s.value} className="h-9 w-40" />
                </div>
              ))}
              <div className="pt-2">
                <Button type="submit" size="sm">Save</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Org defaults */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Defaults (§E.3 / §E.4)</CardTitle>
            <CardDescription>Fallback tier for unmapped ZIPs and the travel origin (may be blank).</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateOrgDefaults} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm">
                Default market tier
                <Select name="defaultMarketTierKey" defaultValue={org?.defaultMarketTierKey ?? ""}>
                  {marketTiers.map((t) => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </Select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Travel origin address (optional)
                <Input name="originAddress" defaultValue={org?.originAddress ?? ""} placeholder="Leave blank — manual travel for now" />
              </label>
              <div>
                <Button type="submit" size="sm">Save</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* ZIP → tier mappings */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">ZIP → tier mappings (§E.3)</CardTitle>
            <CardDescription>Starter map is provisional. Edit a tier, delete a row, or add a ZIP.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <form action={updateZipMappings} className="flex flex-col gap-2">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {zips.map((z) => (
                  <div key={z.id} className="flex items-center gap-2">
                    <span className="w-16 font-mono text-sm">{z.zip}</span>
                    <Select name={`tier_${z.id}`} defaultValue={z.tierKey} className="h-9 flex-1">
                      {marketTiers.map((t) => (
                        <option key={t.key} value={t.key}>{tierLabel(t.key)}</option>
                      ))}
                    </Select>
                    <Button type="submit" formAction={deleteZipMapping} name="id" value={z.id} variant="ghost" size="sm" aria-label={`Delete ${z.zip}`}>
                      ✕
                    </Button>
                  </div>
                ))}
              </div>
              <div className="pt-1">
                <Button type="submit" size="sm">Save tiers</Button>
              </div>
            </form>

            <form action={addZipMapping} className="flex items-end gap-2 border-t border-border pt-4">
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Add ZIP
                <Input name="zip" placeholder="34102" className="h-9 w-28" inputMode="numeric" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Tier
                <Select name="tierKey" className="h-9 w-44" defaultValue={marketTiers[0]?.key ?? ""}>
                  {marketTiers.map((t) => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </Select>
              </label>
              <Button type="submit" variant="outline" size="sm">Add</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LabeledInput({
  name,
  label,
  value,
  step = "0.01",
}: {
  name: string;
  label: string;
  value: number;
  step?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <Input name={name} type="number" step={step} defaultValue={String(value)} className="h-9" />
    </label>
  );
}
