/**
 * Audit diffing (BUILD_SPEC §G Phase 3 — "audit logs on pricing changes") — PURE.
 *
 * Given the before/after of an Admin pricing edit, produce one change descriptor
 * per field that actually moved. The pricing server actions read the old rows,
 * apply the update, then call these helpers to write AuditLog entries. Pure (no
 * Prisma / React), so the change detection is unit-testable on its own.
 */

export interface FieldChange {
  entity: string; // "MarketTier"
  entityLabel?: string; // "Naples"
  field: string; // "hourlyRate"
  oldValue: string;
  newValue: string;
}

const EPSILON = 1e-9;

/** True when two numbers differ beyond floating-point noise. */
export function numbersDiffer(a: number, b: number): boolean {
  return Math.abs(a - b) > EPSILON;
}

/**
 * Compare one field. Returns a change, or null when unchanged / not comparable.
 * Numbers are compared numerically (so 85 vs 85.0 is no change); everything else
 * by trimmed string equality.
 */
export function diffValue(
  entity: string,
  entityLabel: string | undefined,
  field: string,
  oldValue: unknown,
  newValue: unknown,
): FieldChange | null {
  if (newValue === undefined || newValue === null) return null; // not submitted

  if (typeof oldValue === "number" && typeof newValue === "number") {
    if (!Number.isFinite(newValue)) return null;
    if (!numbersDiffer(oldValue, newValue)) return null;
    return { entity, entityLabel, field, oldValue: String(oldValue), newValue: String(newValue) };
  }

  const o = oldValue === undefined || oldValue === null ? "" : String(oldValue).trim();
  const n = String(newValue).trim();
  if (o === n) return null;
  return { entity, entityLabel, field, oldValue: o, newValue: n };
}

/** Diff several numeric fields of one record at once. */
export function diffNumericFields(
  entity: string,
  entityLabel: string | undefined,
  before: Record<string, number>,
  after: Record<string, number | undefined>,
  fields: string[],
): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const field of fields) {
    const change = diffValue(entity, entityLabel, field, before[field], after[field]);
    if (change) changes.push(change);
  }
  return changes;
}

/** Human-readable one-liner for an AuditLog `summary`. */
export function describeChange(change: FieldChange): string {
  const who = change.entityLabel ? `${change.entity} (${change.entityLabel})` : change.entity;
  return `${who} · ${change.field}: ${change.oldValue} → ${change.newValue}`;
}
