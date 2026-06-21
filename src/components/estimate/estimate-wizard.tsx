"use client";

import * as React from "react";
import {
  computeResidentialQuote,
  type PricingConfig,
  type ResidentialQuoteInput,
} from "@/lib/pricing";
import { currency, currency0 } from "@/lib/format";
import { findDuplicatesAction, saveResidentialEstimateAction } from "@/app/(app)/estimate/actions";
import type { DuplicateCandidate } from "@/lib/customers/dedupe";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { QuoteResults } from "@/components/estimate/quote-results";

const STEPS = ["Customer", "Property", "Conditions", "Features", "Service", "Add-ons", "Results"] as const;
const RESULTS_STEP = STEPS.length - 1;

interface FormState {
  customerName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  zip: string;
  notes: string;
  sqft: number;
  bedrooms: number;
  bathrooms: number;
  propertyTypeKey: string;
  tierOverride: string;
  occupancyKey: string;
  flooringKey: string;
  conditionKey: string;
  petKey: string;
  featureKeys: string[];
  frequencyKey: string;
  seasonalOverride: "" | "peak" | "off";
  travelMiles: number;
  addOnQty: Record<string, number>;
}

function preferKey(rows: { key: string }[], preferred: string): string {
  return rows.some((r) => r.key === preferred) ? preferred : (rows[0]?.key ?? "");
}

export function EstimateWizard({
  config,
  isAdmin,
  orgName,
}: {
  config: PricingConfig;
  isAdmin: boolean;
  orgName: string;
}) {
  const residentialAddOns = React.useMemo(
    () => config.addOns.filter((a) => a.category === "Residential"),
    [config.addOns],
  );

  const [step, setStep] = React.useState(0);
  const [form, setForm] = React.useState<FormState>(() => ({
    customerName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    zip: "",
    notes: "",
    sqft: 2000,
    bedrooms: 3,
    bathrooms: 2,
    propertyTypeKey: preferKey(config.propertyTypes, "SingleFamily"),
    tierOverride: "",
    occupancyKey: preferKey(config.occupancyMultipliers, "Couple"),
    flooringKey: preferKey(config.flooringMultipliers, "Tile"),
    conditionKey: preferKey(config.conditionMultipliers, "Average"),
    petKey: preferKey(config.petAdjustments, "None"),
    featureKeys: [],
    frequencyKey: preferKey(config.frequencyMultipliers, "Biweekly"),
    seasonalOverride: "",
    travelMiles: 0,
    addOnQty: {},
  }));

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleFeature(key: string) {
    setForm((prev) => ({
      ...prev,
      featureKeys: prev.featureKeys.includes(key)
        ? prev.featureKeys.filter((k) => k !== key)
        : [...prev.featureKeys, key],
    }));
  }

  function setAddOnQty(key: string, qty: number) {
    setForm((prev) => ({ ...prev, addOnQty: { ...prev.addOnQty, [key]: Math.max(0, qty) } }));
  }

  // Phase 2 — customer linking, duplicate detection (§F), and save state.
  const [linkedCustomerId, setLinkedCustomerId] = React.useState<string | null>(null);
  const [duplicates, setDuplicates] = React.useState<DuplicateCandidate[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  function linkCustomer(candidate: DuplicateCandidate) {
    const c = candidate.customer;
    setLinkedCustomerId(c.id);
    setForm((prev) => ({
      ...prev,
      customerName: c.name ?? prev.customerName,
      email: c.email ?? prev.email,
      phone: c.phone ?? prev.phone,
      address: c.address ?? prev.address,
      city: c.city ?? prev.city,
      zip: c.zip ?? prev.zip,
    }));
    setDuplicates([]);
  }

  function unlinkCustomer() {
    setLinkedCustomerId(null);
  }

  const input: ResidentialQuoteInput = React.useMemo(
    () => ({
      sqft: form.sqft,
      bedrooms: form.bedrooms,
      bathrooms: form.bathrooms,
      zip: form.zip || null,
      marketTierKeyOverride: form.tierOverride || null,
      propertyTypeKey: form.propertyTypeKey || null,
      occupancyKey: form.occupancyKey,
      flooringKey: form.flooringKey,
      conditionKey: form.conditionKey,
      petKey: form.petKey,
      featureKeys: form.featureKeys,
      frequencyKey: form.frequencyKey,
      travelMiles: form.travelMiles,
      addOns: Object.entries(form.addOnQty).map(([key, quantity]) => ({ key, quantity })),
      seasonalOverride: form.seasonalOverride || null,
      quoteDate: new Date(),
    }),
    [form],
  );

  const { result, error } = React.useMemo(() => {
    try {
      return { result: computeResidentialQuote(input, config), error: null as string | null };
    } catch (e) {
      return { result: null, error: e instanceof Error ? e.message : "Could not price this quote." };
    }
  }, [input, config]);

  const headline = result ? currency0(result.primary.preTaxPrice) : "—";

  // Live, debounced duplicate detection for the customer step (§F). All state
  // updates happen inside the (async) timeout/promise — never synchronously in
  // the effect body — to avoid cascading renders.
  const { customerName, email, phone, address, zip } = form;
  React.useEffect(() => {
    let active = true;
    const handle = setTimeout(() => {
      const hasIdentity = customerName.trim() || email.trim() || phone.trim();
      if (linkedCustomerId || !hasIdentity) {
        if (active) setDuplicates([]);
        return;
      }
      findDuplicatesAction({ name: customerName, email, phone, address, zip })
        .then((d) => active && setDuplicates(d))
        .catch(() => active && setDuplicates([]));
    }, 400);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [customerName, email, phone, address, zip, linkedCustomerId]);

  async function handleSave() {
    if (!result) return;
    setSaving(true);
    setSaveError(null);
    const res = await saveResidentialEstimateAction({
      sqft: form.sqft,
      bedrooms: form.bedrooms,
      bathrooms: form.bathrooms,
      zip: form.zip || null,
      marketTierKeyOverride: form.tierOverride || null,
      propertyTypeKey: form.propertyTypeKey || null,
      occupancyKey: form.occupancyKey,
      flooringKey: form.flooringKey,
      conditionKey: form.conditionKey,
      petKey: form.petKey,
      featureKeys: form.featureKeys,
      frequencyKey: form.frequencyKey,
      travelMiles: form.travelMiles,
      addOns: Object.entries(form.addOnQty).map(([key, quantity]) => ({ key, quantity })),
      seasonalOverride: form.seasonalOverride || null,
      customer: {
        customerId: linkedCustomerId,
        name: form.customerName || null,
        email: form.email || null,
        phone: form.phone || null,
        address: form.address || null,
        city: form.city || null,
        zip: form.zip || null,
        notes: form.notes || null,
      },
    });
    // Success redirects server-side; a returned value means it failed.
    setSaveError(res.error);
    setSaving(false);
  }

  // --- Step bodies -----------------------------------------------------------

  function renderCustomer() {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Customer name" full>
          <Input value={form.customerName} onChange={(e) => setField("customerName", e.target.value)} placeholder="Jane Doe" />
        </Field>
        <Field label="Email">
          <Input type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} placeholder="jane@example.com" />
        </Field>
        <Field label="Phone">
          <Input value={form.phone} onChange={(e) => setField("phone", e.target.value)} placeholder="(239) 555-0100" />
        </Field>
        <Field label="Address" full>
          <Input value={form.address} onChange={(e) => setField("address", e.target.value)} placeholder="123 Gulf Shore Blvd" />
        </Field>
        <Field label="City">
          <Input value={form.city} onChange={(e) => setField("city", e.target.value)} placeholder="Naples" />
        </Field>
        <Field label="ZIP (sets market tier)">
          <Input value={form.zip} onChange={(e) => setField("zip", e.target.value)} placeholder="34102" inputMode="numeric" />
        </Field>
        <Field label="Notes" full>
          <Textarea value={form.notes} onChange={(e) => setField("notes", e.target.value)} placeholder="Gate code, parking, special requests…" />
        </Field>
        <div className="sm:col-span-2">
          {linkedCustomerId ? (
            <div className="flex items-center justify-between rounded-md border border-green-600/40 bg-green-50 px-3 py-2 text-sm dark:bg-green-950/30">
              <span className="text-green-700 dark:text-green-400">✓ Linked to an existing customer.</span>
              <button type="button" onClick={unlinkCustomer} className="text-xs text-muted-foreground underline hover:text-foreground">
                Unlink
              </button>
            </div>
          ) : duplicates.length > 0 ? (
            <div className="rounded-md border border-brand-gold/50 bg-brand-gold/5 p-3">
              <p className="text-xs font-medium">
                Possible existing customer{duplicates.length > 1 ? "s" : ""} — link to avoid a duplicate:
              </p>
              <ul className="mt-2 flex flex-col gap-2">
                {duplicates.slice(0, 4).map((d) => (
                  <li key={d.customer.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0">
                      <span className="font-medium">{d.customer.name}</span>{" "}
                      <span className="text-xs text-muted-foreground">
                        {[d.customer.email, d.customer.phone].filter(Boolean).join(" · ")}
                        {d.reasons.length ? ` — ${d.reasons.join(", ")}` : ""}
                      </span>
                    </span>
                    <Button type="button" variant="outline" size="sm" onClick={() => linkCustomer(d)}>
                      Use this
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              This info is saved with the quote and creates a customer record. We&apos;ll flag
              possible duplicates as you type.
            </p>
          )}
        </div>
      </div>
    );
  }

  function renderProperty() {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Square footage">
          <Input type="number" min={1} value={form.sqft} onChange={(e) => setField("sqft", Number(e.target.value))} />
        </Field>
        <Field label="Property type">
          <Select value={form.propertyTypeKey} onChange={(e) => setField("propertyTypeKey", e.target.value)}>
            {config.propertyTypes.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Bedrooms">
          <Input type="number" min={0} value={form.bedrooms} onChange={(e) => setField("bedrooms", Number(e.target.value))} />
        </Field>
        <Field label="Bathrooms">
          <Input type="number" min={0} step={0.5} value={form.bathrooms} onChange={(e) => setField("bathrooms", Number(e.target.value))} />
        </Field>
        <Field label="Market tier override" full>
          <Select value={form.tierOverride} onChange={(e) => setField("tierOverride", e.target.value)}>
            <option value="">Auto (by ZIP{form.zip ? "" : " — using org default"})</option>
            {config.marketTiers.map((t) => (
              <option key={t.key} value={t.key}>{t.label} — {currency(t.hourlyRate)}/hr</option>
            ))}
          </Select>
          {result && (
            <p className="text-xs text-muted-foreground">
              Resolved: <span className="font-medium text-foreground">{result.marketTier.label}</span> ({result.marketTier.source}) ·{" "}
              {currency(result.marketTier.hourlyRate)}/hr · min {currency0(result.marketTier.minimumCharge)}
            </p>
          )}
        </Field>
      </div>
    );
  }

  function renderConditions() {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Occupancy">
          <Select value={form.occupancyKey} onChange={(e) => setField("occupancyKey", e.target.value)}>
            {config.occupancyMultipliers.map((o) => (
              <option key={o.key} value={o.key}>{o.label} (×{o.multiplier})</option>
            ))}
          </Select>
        </Field>
        <Field label="Flooring">
          <Select value={form.flooringKey} onChange={(e) => setField("flooringKey", e.target.value)}>
            {config.flooringMultipliers.map((o) => (
              <option key={o.key} value={o.key}>{o.label} (×{o.multiplier})</option>
            ))}
          </Select>
        </Field>
        <Field label="Condition">
          <Select value={form.conditionKey} onChange={(e) => setField("conditionKey", e.target.value)}>
            {config.conditionMultipliers.map((o) => (
              <option key={o.key} value={o.key}>{o.label} (×{o.multiplier})</option>
            ))}
          </Select>
        </Field>
        <Field label="Pets">
          <Select value={form.petKey} onChange={(e) => setField("petKey", e.target.value)}>
            {config.petAdjustments.map((o) => (
              <option key={o.key} value={o.key}>{o.label} (+{o.hours} hr)</option>
            ))}
          </Select>
        </Field>
      </div>
    );
  }

  function renderFeatures() {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {config.featureOptions.map((f) => {
          const checked = form.featureKeys.includes(f.key);
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => toggleFeature(f.key)}
              className={[
                "flex items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition-colors",
                checked ? "border-primary bg-primary/10 font-medium" : "border-border hover:bg-muted",
              ].join(" ")}
              aria-pressed={checked}
            >
              <span>{f.label}</span>
              <span className="text-xs text-muted-foreground">+{f.hours} hr</span>
            </button>
          );
        })}
      </div>
    );
  }

  function renderService() {
    return (
      <div className="flex flex-col gap-5">
        <div>
          <Label className="mb-2 block">Service frequency</Label>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {config.frequencyMultipliers.map((f) => {
              const selected = form.frequencyKey === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setField("frequencyKey", f.key)}
                  className={[
                    "rounded-lg border px-4 py-3 text-left text-sm transition-colors",
                    selected ? "border-primary bg-primary/10 font-medium" : "border-border hover:bg-muted",
                  ].join(" ")}
                  aria-pressed={selected}
                >
                  <div>{f.label}</div>
                  <div className="text-xs text-muted-foreground">
                    ×{f.multiplier}
                    {f.visitsPerMonth ? ` · ${f.visitsPerMonth}/mo` : f.isOneTime ? " · one-time" : ""}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Seasonal">
            <Select value={form.seasonalOverride} onChange={(e) => setField("seasonalOverride", e.target.value as FormState["seasonalOverride"])}>
              <option value="">Auto (by quote date)</option>
              <option value="peak">Peak (Nov–Apr)</option>
              <option value="off">Off-season (May–Oct)</option>
            </Select>
            {result && (
              <p className="text-xs text-muted-foreground">
                Applied: {result.seasonal.isPeak ? "peak ×" : "off-season ×"}
                {result.seasonal.multiplier} ({result.seasonal.source})
              </p>
            )}
          </Field>
          <Field label="Travel distance (miles)">
            <Input type="number" min={0} value={form.travelMiles} onChange={(e) => setField("travelMiles", Number(e.target.value))} />
            {result?.primary.travelManualReview && (
              <p className="text-xs text-brand-gold">30+ miles — flagged for manual review.</p>
            )}
          </Field>
        </div>
      </div>
    );
  }

  function renderAddOns() {
    if (residentialAddOns.length === 0) {
      return <p className="text-sm text-muted-foreground">No add-ons configured.</p>;
    }
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {residentialAddOns.map((a) => {
          const qty = form.addOnQty[a.key] ?? 0;
          const isPerUnit = a.unit === "PerUnit";
          return (
            <div key={a.key} className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3">
              <div className="text-sm">
                <div className="font-medium">{a.label}</div>
                <div className="text-xs text-muted-foreground">
                  {currency(a.price)}
                  {isPerUnit ? " each" : " flat"}
                </div>
              </div>
              {isPerUnit ? (
                <Input
                  type="number"
                  min={0}
                  value={qty}
                  onChange={(e) => setAddOnQty(a.key, Number(e.target.value))}
                  className="h-9 w-20"
                  aria-label={`${a.label} quantity`}
                />
              ) : (
                <input
                  type="checkbox"
                  checked={qty > 0}
                  onChange={(e) => setAddOnQty(a.key, e.target.checked ? 1 : 0)}
                  className="h-5 w-5 accent-[var(--primary)]"
                  aria-label={a.label}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  function renderStepBody() {
    switch (step) {
      case 0:
        return renderCustomer();
      case 1:
        return renderProperty();
      case 2:
        return renderConditions();
      case 3:
        return renderFeatures();
      case 4:
        return renderService();
      case 5:
        return renderAddOns();
      default:
        return null;
    }
  }

  // --- Layout ----------------------------------------------------------------

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">New residential estimate</h1>
        <p className="text-muted-foreground">{orgName}</p>
      </div>

      <StepIndicator step={step} onJump={setStep} />

      {step === RESULTS_STEP ? (
        <div className="flex flex-col gap-6">
          {error || !result ? (
            <Card className="border-brand-gold/60">
              <CardHeader>
                <CardTitle>Can&apos;t price this quote yet</CardTitle>
                <CardDescription>{error ?? "Check the inputs and try again."}</CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <>
              {(form.customerName || form.address) && (
                <Card className="bg-muted/40">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{form.customerName || "Quote"}</CardTitle>
                    <CardDescription>
                      {[form.address, form.city, form.zip].filter(Boolean).join(", ")}
                      {form.address || form.city || form.zip ? " · " : ""}
                      {form.sqft} sq ft · {form.bedrooms} bd · {form.bathrooms} ba
                    </CardDescription>
                  </CardHeader>
                </Card>
              )}
              <QuoteResults result={result} isAdmin={isAdmin} />
            </>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => setStep(RESULTS_STEP - 1)}>
              ← Back to edit
            </Button>
            <Button variant="ghost" onClick={() => setStep(0)}>
              Start over
            </Button>
            <div className="flex-1" />
            <Button onClick={handleSave} disabled={saving || !result}>
              {saving ? "Saving…" : "Save estimate"}
            </Button>
          </div>
          {saveError && <p className="text-right text-xs text-brand-gold">{saveError}</p>}
          <p className="text-right text-xs text-muted-foreground">
            Saving creates the quote &amp; customer record. Generate the branded proposal &amp; GHL
            handoff on the next screen.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>
                {step + 1}. {STEPS[step]}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderStepBody()}
              <div className="mt-6 flex items-center justify-between">
                <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
                  ← Back
                </Button>
                <Button onClick={() => setStep((s) => Math.min(RESULTS_STEP, s + 1))}>
                  {step === RESULTS_STEP - 1 ? "See results →" : "Next →"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Live running price (§F) */}
          <div className="lg:sticky lg:top-20 lg:self-start">
            <Card className="border-primary/40">
              <CardHeader className="pb-2">
                <CardDescription>{result?.isRecurring ? `Per visit · ${result.primary.frequencyLabel}` : "Live price"}</CardDescription>
                <CardTitle className="text-4xl text-primary">{headline}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1 text-sm">
                {error ? (
                  <p className="text-muted-foreground">{error}</p>
                ) : result ? (
                  <>
                    {result.isRecurring && result.projectedMonthly !== null && (
                      <Row label="Projected monthly" value={currency(result.projectedMonthly)} />
                    )}
                    {result.isRecurring && result.initialDeepClean && (
                      <Row label="Initial deep clean" value={currency0(result.initialDeepClean.preTaxPrice)} />
                    )}
                    <Row label="Labor hours" value={`${result.primary.laborHours}`} muted />
                    <Row label="Production hours" value={`${result.primary.productionHours}`} muted />
                    <Row label="Market tier" value={result.marketTier.label} muted />
                    {isAdmin && (
                      <Row
                        label="Labor %"
                        value={`${(result.primary.margin.laborPct * 100).toFixed(1)}%`}
                        muted
                      />
                    )}
                  </>
                ) : null}
                <p className="pt-2 text-xs text-muted-foreground">Updates live as you go.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={["flex flex-col gap-1.5", full ? "sm:col-span-2" : ""].join(" ")}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: React.ReactNode; muted?: boolean }) {
  return (
    <div className={["flex items-baseline justify-between gap-3", muted ? "text-muted-foreground" : ""].join(" ")}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function StepIndicator({ step, onJump }: { step: number; onJump: (n: number) => void }) {
  return (
    <ol className="flex flex-wrap gap-2 text-xs">
      {STEPS.map((name, i) => {
        const state = i === step ? "current" : i < step ? "done" : "todo";
        return (
          <li key={name}>
            <button
              type="button"
              onClick={() => onJump(i)}
              className={[
                "rounded-full px-3 py-1 font-medium transition-colors",
                state === "current"
                  ? "bg-primary text-primary-foreground"
                  : state === "done"
                    ? "bg-secondary text-secondary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/70",
              ].join(" ")}
            >
              {i + 1}. {name}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
