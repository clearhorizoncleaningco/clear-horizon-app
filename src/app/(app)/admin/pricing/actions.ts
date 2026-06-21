"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";
import { diffValue, type FieldChange } from "@/lib/audit/diff";
import { recordPricingChanges, type AuditActor } from "@/lib/audit/service";

/**
 * Admin-only, org-scoped pricing edits (BUILD_SPEC §E — every value is
 * DB-stored and Admin-editable). Every action:
 *   1. re-verifies the caller is an Admin in the DAL (defense in depth),
 *   2. scopes every write by organizationId via updateMany (a forged id from
 *      another org updates 0 rows),
 *   3. records an AuditLog row per changed field (§G Phase 3 — "audit logs on
 *      pricing changes"): it reads the old values first, then logs old → new, and
 *   4. revalidates the settings page so the new values render.
 */

const PATH = "/admin/pricing";

async function requireAdminActor(): Promise<AuditActor> {
  const { user, profile } = await requireProfile();
  if (!profile) throw new Error("Account not provisioned to an organization.");
  if (profile.role !== "Admin") throw new Error("Admin access required to edit pricing.");
  return { organizationId: profile.organizationId, userId: user.id, userEmail: profile.email };
}

/** Collect `${prefix}<id>` → finite number pairs from a FormData submission. */
function numericRows(formData: FormData, prefix: string): { id: string; value: number }[] {
  const rows: { id: string; value: number }[] = [];
  for (const [key, raw] of formData.entries()) {
    if (!key.startsWith(prefix)) continue;
    const value = Number(raw);
    if (Number.isFinite(value)) rows.push({ id: key.slice(prefix.length), value });
  }
  return rows;
}

function done() {
  revalidatePath(PATH);
}

// ---------------------------------------------------------------------------
// Market tiers — hourly rate + minimum charge
// ---------------------------------------------------------------------------
export async function updateMarketTiers(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  const orgId = actor.organizationId;
  const rates = numericRows(formData, "rate_");
  const mins = new Map(numericRows(formData, "min_").map((r) => [r.id, r.value]));

  const before = await prisma.marketTier.findMany({
    where: { organizationId: orgId, id: { in: rates.map((r) => r.id) } },
  });
  const beforeById = new Map(before.map((t) => [t.id, t]));

  await prisma.$transaction(
    rates.map((r) =>
      prisma.marketTier.updateMany({
        where: { id: r.id, organizationId: orgId },
        data: { hourlyRate: r.value, minimumCharge: mins.get(r.id) ?? undefined },
      }),
    ),
  );

  const changes: FieldChange[] = [];
  for (const r of rates) {
    const old = beforeById.get(r.id);
    if (!old) continue;
    push(changes, diffValue("MarketTier", old.label, "hourlyRate", old.hourlyRate.toNumber(), r.value));
    push(changes, diffValue("MarketTier", old.label, "minimumCharge", old.minimumCharge.toNumber(), mins.get(r.id)));
  }
  await recordPricingChanges(actor, changes);
  done();
}

// ---------------------------------------------------------------------------
// Multiplier tables (occupancy / flooring / condition / property type)
// ---------------------------------------------------------------------------
type MultiplierModel = "occupancy" | "flooring" | "condition" | "property";
const MULTIPLIER_ENTITY: Record<MultiplierModel, string> = {
  occupancy: "OccupancyMultiplier",
  flooring: "FlooringMultiplier",
  condition: "ConditionMultiplier",
  property: "PropertyType",
};

export async function updateMultipliers(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  const orgId = actor.organizationId;
  const model = String(formData.get("model")) as MultiplierModel;
  const rows = numericRows(formData, "m_");
  const ids = rows.map((r) => r.id);
  const where = (id: string) => ({ id, organizationId: orgId });

  const labels = await loadLabels(model, orgId, ids);

  await prisma.$transaction(
    rows.map((r) => {
      const data = { multiplier: r.value };
      switch (model) {
        case "occupancy":
          return prisma.occupancyMultiplier.updateMany({ where: where(r.id), data });
        case "flooring":
          return prisma.flooringMultiplier.updateMany({ where: where(r.id), data });
        case "condition":
          return prisma.conditionMultiplier.updateMany({ where: where(r.id), data });
        case "property":
          return prisma.propertyType.updateMany({ where: where(r.id), data });
        default:
          throw new Error(`Unknown multiplier model: ${model}`);
      }
    }),
  );

  const changes: FieldChange[] = [];
  for (const r of rows) {
    const old = labels.get(r.id);
    push(changes, diffValue(MULTIPLIER_ENTITY[model], old?.label, "multiplier", old?.value ?? null, r.value));
  }
  await recordPricingChanges(actor, changes);
  done();
}

async function loadLabels(
  model: MultiplierModel,
  orgId: string,
  ids: string[],
): Promise<Map<string, { label: string; value: number }>> {
  const where = { organizationId: orgId, id: { in: ids } };
  const select = { id: true, label: true, multiplier: true };
  const rows =
    model === "occupancy"
      ? await prisma.occupancyMultiplier.findMany({ where, select })
      : model === "flooring"
        ? await prisma.flooringMultiplier.findMany({ where, select })
        : model === "condition"
          ? await prisma.conditionMultiplier.findMany({ where, select })
          : await prisma.propertyType.findMany({ where, select });
  return new Map(rows.map((r) => [r.id, { label: r.label, value: r.multiplier.toNumber() }]));
}

// ---------------------------------------------------------------------------
// Additive hour tables (pets / features / bedrooms)
// ---------------------------------------------------------------------------
type HoursModel = "pet" | "feature" | "bedroom";
const HOURS_ENTITY: Record<HoursModel, string> = {
  pet: "PetAdjustment",
  feature: "FeatureOption",
  bedroom: "BedroomAdjustment",
};

export async function updateHours(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  const orgId = actor.organizationId;
  const model = String(formData.get("model")) as HoursModel;
  const rows = numericRows(formData, "h_");
  const ids = rows.map((r) => r.id);
  const where = (id: string) => ({ id, organizationId: orgId });

  const before = new Map<string, { label: string; value: number }>();
  if (model === "pet") {
    for (const r of await prisma.petAdjustment.findMany({ where: { organizationId: orgId, id: { in: ids } } }))
      before.set(r.id, { label: r.label, value: r.hours.toNumber() });
  } else if (model === "feature") {
    for (const r of await prisma.featureOption.findMany({ where: { organizationId: orgId, id: { in: ids } } }))
      before.set(r.id, { label: r.label, value: r.hours.toNumber() });
  } else {
    for (const r of await prisma.bedroomAdjustment.findMany({ where: { organizationId: orgId, id: { in: ids } } }))
      before.set(r.id, { label: `${r.minBeds}${r.maxBeds === null ? "+" : `–${r.maxBeds}`} bd`, value: r.hours.toNumber() });
  }

  await prisma.$transaction(
    rows.map((r) => {
      const data = { hours: r.value };
      switch (model) {
        case "pet":
          return prisma.petAdjustment.updateMany({ where: where(r.id), data });
        case "feature":
          return prisma.featureOption.updateMany({ where: where(r.id), data });
        case "bedroom":
          return prisma.bedroomAdjustment.updateMany({ where: where(r.id), data });
        default:
          throw new Error(`Unknown hours model: ${model}`);
      }
    }),
  );

  const changes: FieldChange[] = [];
  for (const r of rows) {
    const old = before.get(r.id);
    push(changes, diffValue(HOURS_ENTITY[model], old?.label, "hours", old?.value ?? null, r.value));
  }
  await recordPricingChanges(actor, changes);
  done();
}

// ---------------------------------------------------------------------------
// Sqft labor tiers — base hours (+ step hours on the open-ended tier)
// ---------------------------------------------------------------------------
export async function updateSqftTiers(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  const orgId = actor.organizationId;
  const base = numericRows(formData, "base_");
  const step = new Map(numericRows(formData, "step_").map((r) => [r.id, r.value]));

  const before = await prisma.sqftLaborTier.findMany({
    where: { organizationId: orgId, id: { in: base.map((r) => r.id) } },
  });
  const beforeById = new Map(before.map((t) => [t.id, t]));

  await prisma.$transaction(
    base.map((r) =>
      prisma.sqftLaborTier.updateMany({
        where: { id: r.id, organizationId: orgId },
        data: { baseHours: r.value, stepHours: step.has(r.id) ? step.get(r.id) : undefined },
      }),
    ),
  );

  const changes: FieldChange[] = [];
  for (const r of base) {
    const old = beforeById.get(r.id);
    if (!old) continue;
    const label = `${old.minSqft}–${old.maxSqft ?? "+"} sqft`;
    push(changes, diffValue("SqftLaborTier", label, "baseHours", old.baseHours.toNumber(), r.value));
    if (step.has(r.id)) {
      push(changes, diffValue("SqftLaborTier", label, "stepHours", old.stepHours?.toNumber() ?? null, step.get(r.id)));
    }
  }
  await recordPricingChanges(actor, changes);
  done();
}

// ---------------------------------------------------------------------------
// Frequencies — multiplier + visits/month
// ---------------------------------------------------------------------------
export async function updateFrequencies(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  const orgId = actor.organizationId;
  const mults = numericRows(formData, "mult_");
  const vpmRaw = new Map<string, FormDataEntryValue>();
  for (const [key, raw] of formData.entries()) {
    if (key.startsWith("vpm_")) vpmRaw.set(key.slice(4), raw);
  }

  const before = await prisma.frequencyMultiplier.findMany({
    where: { organizationId: orgId, id: { in: mults.map((r) => r.id) } },
  });
  const beforeById = new Map(before.map((f) => [f.id, f]));

  await prisma.$transaction(
    mults.map((r) => {
      const raw = vpmRaw.get(r.id);
      const text = raw === undefined ? "" : String(raw).trim();
      const visitsPerMonth = text === "" ? null : Number(text);
      return prisma.frequencyMultiplier.updateMany({
        where: { id: r.id, organizationId: orgId },
        data: {
          multiplier: r.value,
          visitsPerMonth: visitsPerMonth !== null && Number.isFinite(visitsPerMonth) ? visitsPerMonth : null,
        },
      });
    }),
  );

  const changes: FieldChange[] = [];
  for (const r of mults) {
    const old = beforeById.get(r.id);
    if (!old) continue;
    push(changes, diffValue("FrequencyMultiplier", old.label, "multiplier", old.multiplier.toNumber(), r.value));
    const raw = vpmRaw.get(r.id);
    if (raw !== undefined) {
      const text = String(raw).trim();
      const newVpm = text === "" ? "" : Number(text);
      push(changes, diffValue("FrequencyMultiplier", old.label, "visitsPerMonth", old.visitsPerMonth?.toNumber() ?? "", newVpm));
    }
  }
  await recordPricingChanges(actor, changes);
  done();
}

// ---------------------------------------------------------------------------
// Add-ons — price
// ---------------------------------------------------------------------------
export async function updateAddOns(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  const orgId = actor.organizationId;
  const rows = numericRows(formData, "price_");
  const before = await prisma.addOn.findMany({ where: { organizationId: orgId, id: { in: rows.map((r) => r.id) } } });
  const beforeById = new Map(before.map((a) => [a.id, a]));

  await prisma.$transaction(
    rows.map((r) =>
      prisma.addOn.updateMany({ where: { id: r.id, organizationId: orgId }, data: { price: r.value } }),
    ),
  );

  const changes: FieldChange[] = [];
  for (const r of rows) {
    const old = beforeById.get(r.id);
    push(changes, diffValue("AddOn", old?.label, "price", old?.price.toNumber() ?? null, r.value));
  }
  await recordPricingChanges(actor, changes);
  done();
}

// ---------------------------------------------------------------------------
// Travel brackets — fee
// ---------------------------------------------------------------------------
export async function updateTravelBrackets(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  const orgId = actor.organizationId;
  const rows = numericRows(formData, "fee_");
  const before = await prisma.travelBracket.findMany({ where: { organizationId: orgId, id: { in: rows.map((r) => r.id) } } });
  const beforeById = new Map(before.map((b) => [b.id, b]));

  await prisma.$transaction(
    rows.map((r) =>
      prisma.travelBracket.updateMany({ where: { id: r.id, organizationId: orgId }, data: { fee: r.value } }),
    ),
  );

  const changes: FieldChange[] = [];
  for (const r of rows) {
    const old = beforeById.get(r.id);
    const label = old ? `${old.minMiles}–${old.maxMiles ?? "+"} mi` : undefined;
    push(changes, diffValue("TravelBracket", label, "fee", old?.fee.toNumber() ?? null, r.value));
  }
  await recordPricingChanges(actor, changes);
  done();
}

// ---------------------------------------------------------------------------
// Tax rates — rate (stored as a decimal, e.g. 0.06)
// ---------------------------------------------------------------------------
export async function updateTaxRates(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  const orgId = actor.organizationId;
  const rows = numericRows(formData, "rate_");
  const before = await prisma.taxRate.findMany({ where: { organizationId: orgId, id: { in: rows.map((r) => r.id) } } });
  const beforeById = new Map(before.map((t) => [t.id, t]));

  await prisma.$transaction(
    rows.map((r) =>
      prisma.taxRate.updateMany({ where: { id: r.id, organizationId: orgId }, data: { rate: r.value } }),
    ),
  );

  const changes: FieldChange[] = [];
  for (const r of rows) {
    const old = beforeById.get(r.id);
    push(changes, diffValue("TaxRate", old?.jurisdiction, "rate", old?.rate.toNumber() ?? null, r.value));
  }
  await recordPricingChanges(actor, changes);
  done();
}

// ---------------------------------------------------------------------------
// Scalar pricing settings (bathroom / intensity / rounding / seasonal)
// ---------------------------------------------------------------------------
export async function updatePricingSettings(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  const orgId = actor.organizationId;
  const updates: { id: string; value: string }[] = [];
  for (const [key, raw] of formData.entries()) {
    if (!key.startsWith("val_")) continue;
    const id = key.slice(4);
    const value = String(raw).trim();
    const valueType = String(formData.get(`type_${id}`) ?? "string");

    if (valueType === "number" && !Number.isFinite(Number(value))) {
      throw new Error(`Setting must be a number, got "${value}".`);
    }
    if (valueType === "json") {
      const parsed: unknown = JSON.parse(value); // throws on invalid JSON
      if (!Array.isArray(parsed)) throw new Error("Seasonal peak months must be a JSON array.");
    }
    updates.push({ id, value });
  }

  const before = await prisma.pricingSetting.findMany({
    where: { organizationId: orgId, id: { in: updates.map((u) => u.id) } },
  });
  const beforeById = new Map(before.map((s) => [s.id, s]));

  await prisma.$transaction(
    updates.map((u) =>
      prisma.pricingSetting.updateMany({ where: { id: u.id, organizationId: orgId }, data: { value: u.value } }),
    ),
  );

  const changes: FieldChange[] = [];
  for (const u of updates) {
    const old = beforeById.get(u.id);
    push(changes, diffValue("PricingSetting", old?.key, "value", old?.value ?? null, u.value));
  }
  await recordPricingChanges(actor, changes);
  done();
}

// ---------------------------------------------------------------------------
// Margin config (Admin-only) — single row per org
// ---------------------------------------------------------------------------
export async function updateMarginConfig(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  const orgId = actor.organizationId;
  const num = (name: string): number => {
    const value = Number(formData.get(name));
    if (!Number.isFinite(value)) throw new Error(`Invalid value for ${name}.`);
    return value;
  };
  const next = {
    laborCostPerHour: num("laborCostPerHour"),
    suppliesPerVisit: num("suppliesPerVisit"),
    targetLaborPct: num("targetLaborPct"),
    laborBandMin: num("laborBandMin"),
    laborBandMax: num("laborBandMax"),
  };

  const before = await prisma.marginConfig.findUnique({ where: { organizationId: orgId } });
  await prisma.marginConfig.updateMany({ where: { organizationId: orgId }, data: next });

  if (before) {
    const changes: FieldChange[] = [];
    for (const field of Object.keys(next) as (keyof typeof next)[]) {
      push(changes, diffValue("MarginConfig", undefined, field, before[field].toNumber(), next[field]));
    }
    await recordPricingChanges(actor, changes);
  }
  done();
}

// ---------------------------------------------------------------------------
// Organization defaults — default market tier + travel origin
// ---------------------------------------------------------------------------
export async function updateOrgDefaults(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  const orgId = actor.organizationId;
  const defaultMarketTierKey = String(formData.get("defaultMarketTierKey") ?? "").trim() || null;
  const originAddress = String(formData.get("originAddress") ?? "").trim() || null;

  const before = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { defaultMarketTierKey: true, originAddress: true },
  });
  await prisma.organization.update({ where: { id: orgId }, data: { defaultMarketTierKey, originAddress } });

  const changes: FieldChange[] = [];
  push(changes, diffValue("Organization", undefined, "defaultMarketTierKey", before?.defaultMarketTierKey ?? "", defaultMarketTierKey ?? ""));
  push(changes, diffValue("Organization", undefined, "originAddress", before?.originAddress ?? "", originAddress ?? ""));
  await recordPricingChanges(actor, changes);
  done();
}

// ---------------------------------------------------------------------------
// ZIP → tier mappings (§E.3) — edit / add / delete
// ---------------------------------------------------------------------------
export async function updateZipMappings(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  const orgId = actor.organizationId;
  const updates: { id: string; tierKey: string }[] = [];
  for (const [key, raw] of formData.entries()) {
    if (!key.startsWith("tier_")) continue;
    updates.push({ id: key.slice(5), tierKey: String(raw) });
  }

  const before = await prisma.zipTierMapping.findMany({
    where: { organizationId: orgId, id: { in: updates.map((u) => u.id) } },
  });
  const beforeById = new Map(before.map((z) => [z.id, z]));

  await prisma.$transaction(
    updates.map((u) =>
      prisma.zipTierMapping.updateMany({
        where: { id: u.id, organizationId: orgId },
        data: { tierKey: u.tierKey, isProvisional: false },
      }),
    ),
  );

  const changes: FieldChange[] = [];
  for (const u of updates) {
    const old = beforeById.get(u.id);
    push(changes, diffValue("ZipTierMapping", old?.zip, "tierKey", old?.tierKey ?? "", u.tierKey));
  }
  await recordPricingChanges(actor, changes);
  done();
}

export async function addZipMapping(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  const orgId = actor.organizationId;
  const zip = String(formData.get("zip") ?? "").trim();
  const tierKey = String(formData.get("tierKey") ?? "").trim();
  if (!zip || !tierKey) throw new Error("ZIP and tier are both required.");
  await prisma.zipTierMapping.upsert({
    where: { organizationId_zip: { organizationId: orgId, zip } },
    update: { tierKey, isProvisional: false },
    create: { organizationId: orgId, zip, tierKey, isProvisional: false },
  });
  await recordPricingChanges(actor, [
    { entity: "ZipTierMapping", entityLabel: zip, field: "tierKey", oldValue: "(new)", newValue: tierKey },
  ]);
  done();
}

export async function deleteZipMapping(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  const orgId = actor.organizationId;
  const id = String(formData.get("id") ?? "");
  const existing = await prisma.zipTierMapping.findFirst({ where: { id, organizationId: orgId } });
  await prisma.zipTierMapping.deleteMany({ where: { id, organizationId: orgId } });
  if (existing) {
    await recordPricingChanges(actor, [
      { entity: "ZipTierMapping", entityLabel: existing.zip, field: "tierKey", oldValue: existing.tierKey, newValue: "(deleted)" },
    ]);
  }
  done();
}

/** Push a change onto the list if it is non-null (a field actually moved). */
function push(list: FieldChange[], change: FieldChange | null): void {
  if (change) list.push(change);
}
