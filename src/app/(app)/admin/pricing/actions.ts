"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/dal";
import { prisma } from "@/lib/db";

/**
 * Admin-only, org-scoped pricing edits (BUILD_SPEC §E — every value is
 * DB-stored and Admin-editable). Every action:
 *   1. re-verifies the caller is an Admin in the DAL (defense in depth),
 *   2. scopes every write by organizationId via updateMany (a forged id from
 *      another org updates 0 rows), and
 *   3. revalidates the settings page so the new values render.
 */

const PATH = "/admin/pricing";

async function requireAdminOrgId(): Promise<string> {
  const { profile } = await requireProfile();
  if (!profile) throw new Error("Account not provisioned to an organization.");
  if (profile.role !== "Admin") throw new Error("Admin access required to edit pricing.");
  return profile.organizationId;
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
  const orgId = await requireAdminOrgId();
  const rates = numericRows(formData, "rate_");
  const mins = new Map(numericRows(formData, "min_").map((r) => [r.id, r.value]));
  await prisma.$transaction(
    rates.map((r) =>
      prisma.marketTier.updateMany({
        where: { id: r.id, organizationId: orgId },
        data: { hourlyRate: r.value, minimumCharge: mins.get(r.id) ?? undefined },
      }),
    ),
  );
  done();
}

// ---------------------------------------------------------------------------
// Multiplier tables (occupancy / flooring / condition / property type)
// ---------------------------------------------------------------------------
type MultiplierModel = "occupancy" | "flooring" | "condition" | "property";

export async function updateMultipliers(formData: FormData): Promise<void> {
  const orgId = await requireAdminOrgId();
  const model = String(formData.get("model")) as MultiplierModel;
  const rows = numericRows(formData, "m_");
  const where = (id: string) => ({ id, organizationId: orgId });

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
  done();
}

// ---------------------------------------------------------------------------
// Additive hour tables (pets / features / bedrooms)
// ---------------------------------------------------------------------------
type HoursModel = "pet" | "feature" | "bedroom";

export async function updateHours(formData: FormData): Promise<void> {
  const orgId = await requireAdminOrgId();
  const model = String(formData.get("model")) as HoursModel;
  const rows = numericRows(formData, "h_");
  const where = (id: string) => ({ id, organizationId: orgId });

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
  done();
}

// ---------------------------------------------------------------------------
// Sqft labor tiers — base hours (+ step hours on the open-ended tier)
// ---------------------------------------------------------------------------
export async function updateSqftTiers(formData: FormData): Promise<void> {
  const orgId = await requireAdminOrgId();
  const base = numericRows(formData, "base_");
  const step = new Map(numericRows(formData, "step_").map((r) => [r.id, r.value]));
  await prisma.$transaction(
    base.map((r) =>
      prisma.sqftLaborTier.updateMany({
        where: { id: r.id, organizationId: orgId },
        data: { baseHours: r.value, stepHours: step.has(r.id) ? step.get(r.id) : undefined },
      }),
    ),
  );
  done();
}

// ---------------------------------------------------------------------------
// Frequencies — multiplier + visits/month
// ---------------------------------------------------------------------------
export async function updateFrequencies(formData: FormData): Promise<void> {
  const orgId = await requireAdminOrgId();
  const mults = numericRows(formData, "mult_");
  const vpmRaw = new Map<string, FormDataEntryValue>();
  for (const [key, raw] of formData.entries()) {
    if (key.startsWith("vpm_")) vpmRaw.set(key.slice(4), raw);
  }
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
  done();
}

// ---------------------------------------------------------------------------
// Add-ons — price
// ---------------------------------------------------------------------------
export async function updateAddOns(formData: FormData): Promise<void> {
  const orgId = await requireAdminOrgId();
  const rows = numericRows(formData, "price_");
  await prisma.$transaction(
    rows.map((r) =>
      prisma.addOn.updateMany({ where: { id: r.id, organizationId: orgId }, data: { price: r.value } }),
    ),
  );
  done();
}

// ---------------------------------------------------------------------------
// Travel brackets — fee
// ---------------------------------------------------------------------------
export async function updateTravelBrackets(formData: FormData): Promise<void> {
  const orgId = await requireAdminOrgId();
  const rows = numericRows(formData, "fee_");
  await prisma.$transaction(
    rows.map((r) =>
      prisma.travelBracket.updateMany({ where: { id: r.id, organizationId: orgId }, data: { fee: r.value } }),
    ),
  );
  done();
}

// ---------------------------------------------------------------------------
// Tax rates — rate (stored as a decimal, e.g. 0.06)
// ---------------------------------------------------------------------------
export async function updateTaxRates(formData: FormData): Promise<void> {
  const orgId = await requireAdminOrgId();
  const rows = numericRows(formData, "rate_");
  await prisma.$transaction(
    rows.map((r) =>
      prisma.taxRate.updateMany({ where: { id: r.id, organizationId: orgId }, data: { rate: r.value } }),
    ),
  );
  done();
}

// ---------------------------------------------------------------------------
// Scalar pricing settings (bathroom / intensity / rounding / seasonal)
// ---------------------------------------------------------------------------
export async function updatePricingSettings(formData: FormData): Promise<void> {
  const orgId = await requireAdminOrgId();
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
  await prisma.$transaction(
    updates.map((u) =>
      prisma.pricingSetting.updateMany({ where: { id: u.id, organizationId: orgId }, data: { value: u.value } }),
    ),
  );
  done();
}

// ---------------------------------------------------------------------------
// Margin config (Admin-only) — single row per org
// ---------------------------------------------------------------------------
export async function updateMarginConfig(formData: FormData): Promise<void> {
  const orgId = await requireAdminOrgId();
  const num = (name: string): number => {
    const value = Number(formData.get(name));
    if (!Number.isFinite(value)) throw new Error(`Invalid value for ${name}.`);
    return value;
  };
  await prisma.marginConfig.updateMany({
    where: { organizationId: orgId },
    data: {
      laborCostPerHour: num("laborCostPerHour"),
      suppliesPerVisit: num("suppliesPerVisit"),
      targetLaborPct: num("targetLaborPct"),
      laborBandMin: num("laborBandMin"),
      laborBandMax: num("laborBandMax"),
    },
  });
  done();
}

// ---------------------------------------------------------------------------
// Organization defaults — default market tier + travel origin
// ---------------------------------------------------------------------------
export async function updateOrgDefaults(formData: FormData): Promise<void> {
  const orgId = await requireAdminOrgId();
  const defaultMarketTierKey = String(formData.get("defaultMarketTierKey") ?? "").trim() || null;
  const originAddress = String(formData.get("originAddress") ?? "").trim() || null;
  await prisma.organization.update({
    where: { id: orgId },
    data: { defaultMarketTierKey, originAddress },
  });
  done();
}

// ---------------------------------------------------------------------------
// ZIP → tier mappings (§E.3) — edit / add / delete
// ---------------------------------------------------------------------------
export async function updateZipMappings(formData: FormData): Promise<void> {
  const orgId = await requireAdminOrgId();
  const updates: { id: string; tierKey: string }[] = [];
  for (const [key, raw] of formData.entries()) {
    if (!key.startsWith("tier_")) continue;
    updates.push({ id: key.slice(5), tierKey: String(raw) });
  }
  await prisma.$transaction(
    updates.map((u) =>
      prisma.zipTierMapping.updateMany({
        where: { id: u.id, organizationId: orgId },
        data: { tierKey: u.tierKey, isProvisional: false },
      }),
    ),
  );
  done();
}

export async function addZipMapping(formData: FormData): Promise<void> {
  const orgId = await requireAdminOrgId();
  const zip = String(formData.get("zip") ?? "").trim();
  const tierKey = String(formData.get("tierKey") ?? "").trim();
  if (!zip || !tierKey) throw new Error("ZIP and tier are both required.");
  await prisma.zipTierMapping.upsert({
    where: { organizationId_zip: { organizationId: orgId, zip } },
    update: { tierKey, isProvisional: false },
    create: { organizationId: orgId, zip, tierKey, isProvisional: false },
  });
  done();
}

export async function deleteZipMapping(formData: FormData): Promise<void> {
  const orgId = await requireAdminOrgId();
  const id = String(formData.get("id") ?? "");
  await prisma.zipTierMapping.deleteMany({ where: { id, organizationId: orgId } });
  done();
}
