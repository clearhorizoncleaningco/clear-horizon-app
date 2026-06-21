"use client";

import * as React from "react";
import { computeCommercialQuote, type PricingConfig } from "@/lib/pricing";
import { commercialQuoteInputSchema } from "@/lib/quotes/schema";
import { saveCommercialEstimateAction } from "@/app/(app)/commercial/actions";
import { currency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface LineItem {
  description: string;
  amount: number;
}

export function CommercialQuoteForm({ config, orgName }: { config: PricingConfig; orgName: string }) {
  const commercialTaxableDefault = React.useMemo(
    () => config.serviceTypes.find((s) => s.key === "Commercial")?.taxable ?? true,
    [config.serviceTypes],
  );
  const taxRate = React.useMemo(
    () => config.taxRates.find((t) => t.isDefault)?.rate ?? config.taxRates[0]?.rate ?? 0,
    [config.taxRates],
  );

  const [customerName, setCustomerName] = React.useState("");
  const [basePrice, setBasePrice] = React.useState(0);
  const [frequencyLabel, setFrequencyLabel] = React.useState("");
  const [scopeNotes, setScopeNotes] = React.useState("");
  const [taxable, setTaxable] = React.useState(commercialTaxableDefault);
  const [lineItems, setLineItems] = React.useState<LineItem[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  function updateLineItem(index: number, patch: Partial<LineItem>) {
    setLineItems((prev) => prev.map((li, i) => (i === index ? { ...li, ...patch } : li)));
  }
  function addLineItem() {
    setLineItems((prev) => [...prev, { description: "", amount: 0 }]);
  }
  function removeLineItem(index: number) {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }

  const result = React.useMemo(
    () =>
      computeCommercialQuote(
        {
          basePrice: Number.isFinite(basePrice) ? basePrice : 0,
          lineItems: lineItems.map((li) => ({ description: li.description, amount: Number.isFinite(li.amount) ? li.amount : 0 })),
          taxableOverride: taxable,
        },
        config,
      ),
    [basePrice, lineItems, taxable, config],
  );

  // Validate the structured payload (Zod boundary) — drives the Save gate.
  const parsed = commercialQuoteInputSchema.safeParse({
    customerName: customerName || null,
    basePrice,
    frequencyLabel: frequencyLabel || null,
    scopeNotes: scopeNotes || null,
    lineItems,
    taxableOverride: taxable,
  });

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    // On success the action redirects to the new estimate; if it returns, it failed.
    const res = await saveCommercialEstimateAction({
      customerName: customerName || null,
      basePrice,
      frequencyLabel: frequencyLabel || null,
      scopeNotes: scopeNotes || null,
      lineItems,
      taxableOverride: taxable,
      customer: { name: customerName || null },
    });
    setSaveError(res.error);
    setSaving(false);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Commercial quote (manual)</CardTitle>
            <CardDescription>
              Enter the price you reached from the walk-through. v1 commercial is a manual proposal path — no automated
              engine (BUILD_SPEC §E.8).
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label>Customer / business name</Label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Gulfshore Offices LLC" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Quoted price (per service)</Label>
              <Input type="number" min={0} step="0.01" value={basePrice} onChange={(e) => setBasePrice(Number(e.target.value))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Frequency / schedule</Label>
              <Input value={frequencyLabel} onChange={(e) => setFrequencyLabel(e.target.value)} placeholder="3× / week, nightly, etc." />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label>Scope notes</Label>
              <Textarea value={scopeNotes} onChange={(e) => setScopeNotes(e.target.value)} placeholder="Areas, restrooms, floors, frequency details, supplies…" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Optional line items</CardTitle>
              <CardDescription>Itemize extras (strip &amp; wax, windows, etc.)</CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
              + Add line
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {lineItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No line items. The quoted price stands on its own.</p>
            ) : (
              lineItems.map((li, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={li.description}
                    onChange={(e) => updateLineItem(i, { description: e.target.value })}
                    placeholder="Description"
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={li.amount}
                    onChange={(e) => updateLineItem(i, { amount: Number(e.target.value) })}
                    className="w-32"
                    aria-label="Amount"
                  />
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeLineItem(i)} aria-label="Remove line">
                    ✕
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={taxable}
            onChange={(e) => setTaxable(e.target.checked)}
            className="h-5 w-5 accent-[var(--primary)]"
          />
          Taxable ({(taxRate * 100).toFixed(2)}% — commercial default in FL)
        </label>
      </div>

      {/* Live summary */}
      <div className="lg:sticky lg:top-20 lg:self-start">
        <Card className="border-primary/40">
          <CardHeader className="pb-2">
            <CardDescription>{customerName || orgName} · total</CardDescription>
            <CardTitle className="text-4xl text-primary">{currency(result.total)}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            <SummaryRow label="Quoted price" value={currency(result.basePrice)} />
            {result.lineItemsTotal > 0 && <SummaryRow label="Line items" value={currency(result.lineItemsTotal)} />}
            <SummaryRow label="Subtotal" value={currency(result.subtotal)} />
            {result.taxable && <SummaryRow label={`Tax (${(result.taxRate * 100).toFixed(2)}%)`} value={currency(result.taxAmount)} />}
            <div className="my-1 border-t border-border" />
            <SummaryRow label="Total" value={currency(result.total)} strong />
            {frequencyLabel && <p className="pt-2 text-xs text-muted-foreground">{frequencyLabel}</p>}
            <div className="mt-3 flex flex-col gap-2">
              <Button onClick={handleSave} disabled={!parsed.success || saving}>
                {saving ? "Saving…" : "Save quote"}
              </Button>
            </div>
            {!parsed.success && (
              <p className="pt-1 text-xs text-brand-gold">
                {parsed.error.issues[0]?.message ?? "Check the form before saving."}
              </p>
            )}
            {saveError && <p className="pt-1 text-xs text-brand-gold">{saveError}</p>}
            <p className="pt-1 text-xs text-muted-foreground">
              Saving creates the quote &amp; customer record. Generate the branded proposal and GHL
              handoff on the next screen.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className={["flex items-baseline justify-between gap-3", strong ? "font-semibold" : ""].join(" ")}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
