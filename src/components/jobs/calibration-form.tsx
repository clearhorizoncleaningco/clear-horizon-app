import { logCalibrationAction } from "@/app/(app)/jobs/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Calibration entry form (BUILD_SPEC §G Phase 3 — "log actual crew hours, actual
 * labor $, and price charged per job"). ADMIN-only surface (it feeds margin).
 * A plain server-action form — no client state needed.
 */
export interface CalibrationDefaults {
  jobId: string;
  priceCharged: number | null;
  actualCrewHours: number | null;
  actualLaborCost: number | null;
  actualSuppliesCost: number | null;
  cleanerPayAmount: number | null;
  calibrationNotes: string | null;
}

function val(n: number | null): string {
  return n == null ? "" : String(n);
}

export function CalibrationForm({ defaults }: { defaults: CalibrationDefaults }) {
  return (
    <form action={logCalibrationAction} className="flex flex-col gap-3">
      <input type="hidden" name="jobId" value={defaults.jobId} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field name="priceCharged" label="Price charged ($)" defaultValue={val(defaults.priceCharged)} placeholder="500" />
        <Field name="actualCrewHours" label="Actual crew hours" defaultValue={val(defaults.actualCrewHours)} placeholder="6.0" step="0.25" />
        <Field name="actualLaborCost" label="Actual labor $ (optional)" defaultValue={val(defaults.actualLaborCost)} placeholder="auto from hours" />
        <Field name="actualSuppliesCost" label="Actual supplies $ (optional)" defaultValue={val(defaults.actualSuppliesCost)} placeholder="defaults to seed" />
        <Field name="cleanerPayAmount" label="Cleaner pay ($)" defaultValue={val(defaults.cleanerPayAmount)} placeholder="120" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`notes-${defaults.jobId}`}>Notes (optional)</Label>
        <Textarea
          id={`notes-${defaults.jobId}`}
          name="calibrationNotes"
          defaultValue={defaults.calibrationNotes ?? ""}
          rows={2}
          placeholder="Anything unusual about this job…"
        />
      </div>
      <div>
        <Button type="submit" size="sm">Save actuals</Button>
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  defaultValue,
  placeholder,
  step = "0.01",
}: {
  name: string;
  label: string;
  defaultValue: string;
  placeholder?: string;
  step?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type="number" inputMode="decimal" step={step} min="0" defaultValue={defaultValue} placeholder={placeholder} />
    </div>
  );
}
