/**
 * Seed: Organization + Admin user + all pricing tables (BUILD_SPEC §E defaults).
 *
 * Run with `npm run db:seed` (after `npm run db:deploy`). Idempotent:
 *  - Organization, Admin profile, and MarginConfig are upserted.
 *  - Pricing config tables are seeded only when empty for the org, so re-running
 *    never clobbers Admin edits.
 *
 * Uses RELATIVE imports (not the `@/` alias) because it runs under tsx, which
 * does not resolve tsconfig path aliases.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PrismaClient, type ServiceCategory } from "../src/generated/prisma/client";
import * as D from "../src/lib/pricing/defaults";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.startsWith("placeholder")) {
    throw new Error(
      `Missing/placeholder env var: ${name}. Fill in real Supabase values in .env before seeding.`,
    );
  }
  return value;
}

async function findUserByEmail(
  supabase: SupabaseClient,
  email: string,
): Promise<string | null> {
  const perPage = 200;
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const match = data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );
    if (match) return match.id;
    if (data.users.length < perPage) return null;
  }
}

async function ensureAdminUser(
  supabase: SupabaseClient,
  email: string,
  password: string,
  fullName: string,
): Promise<string> {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role: "Admin" },
  });

  if (data?.user) return data.user.id;

  // Already registered? Look it up and refresh password/metadata.
  if (error && /already|registered|exists/i.test(error.message)) {
    const existingId = await findUserByEmail(supabase, email);
    if (existingId) {
      await supabase.auth.admin.updateUserById(existingId, {
        password,
        user_metadata: { full_name: fullName, role: "Admin" },
      });
      return existingId;
    }
  }

  throw new Error(`Failed to create admin user: ${error?.message ?? "unknown error"}`);
}

async function seedIfEmpty(
  countPromise: Promise<number>,
  create: () => Promise<{ count: number }>,
): Promise<number> {
  const existing = await countPromise;
  if (existing > 0) return existing;
  const { count } = await create();
  return count;
}

async function main() {
  const databaseUrl = requireEnv("DATABASE_URL");
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@clearhorizoncleaners.com";
  const adminPassword = requireEnv("SEED_ADMIN_PASSWORD");
  const adminName = process.env.SEED_ADMIN_NAME ?? "Clear Horizon Admin";
  const orgName = process.env.SEED_ORG_NAME ?? "Clear Horizon Cleaning Co.";
  const orgSlug = process.env.SEED_ORG_SLUG ?? "clear-horizon";

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // 1. Organization ------------------------------------------------------
    const org = await prisma.organization.upsert({
      where: { slug: orgSlug },
      update: { name: orgName, defaultMarketTierKey: D.DEFAULT_MARKET_TIER_KEY },
      create: {
        name: orgName,
        slug: orgSlug,
        contactEmail: "admin@clearhorizoncleaners.com",
        contactPhone: "(239) 396-5740",
        website: "https://www.clearhorizoncleaners.com",
        originAddress: null, // §E.4 — origin may be blank
        defaultMarketTierKey: D.DEFAULT_MARKET_TIER_KEY,
      },
    });
    const orgId = org.id;
    console.log(`✔ Organization: ${org.name} (${orgId})`);

    // 2. Admin user (Supabase Auth) + Profile ------------------------------
    const adminUserId = await ensureAdminUser(supabase, adminEmail, adminPassword, adminName);
    await prisma.profile.upsert({
      where: { id: adminUserId },
      update: { email: adminEmail, fullName: adminName, role: "Admin", organizationId: orgId },
      create: {
        id: adminUserId,
        email: adminEmail,
        fullName: adminName,
        role: "Admin",
        organizationId: orgId,
      },
    });
    console.log(`✔ Admin profile: ${adminEmail} (role Admin)`);

    // 3. Pricing tables (BUILD_SPEC §E) ------------------------------------
    const summary: Record<string, number> = {};

    summary.sqftLaborTiers = await seedIfEmpty(
      prisma.sqftLaborTier.count({ where: { organizationId: orgId } }),
      () =>
        prisma.sqftLaborTier.createMany({
          data: D.SQFT_LABOR_TIERS.map((t, i) => ({
            organizationId: orgId,
            minSqft: t.minSqft,
            maxSqft: t.maxSqft,
            baseHours: t.baseHours,
            thresholdSqft: t.thresholdSqft ?? null,
            stepSqft: t.stepSqft ?? null,
            stepHours: t.stepHours ?? null,
            sortOrder: i,
          })),
        }),
    );

    summary.bedroomAdjustments = await seedIfEmpty(
      prisma.bedroomAdjustment.count({ where: { organizationId: orgId } }),
      () =>
        prisma.bedroomAdjustment.createMany({
          data: D.BEDROOM_ADJUSTMENTS.map((b, i) => ({
            organizationId: orgId,
            minBeds: b.minBeds,
            maxBeds: b.maxBeds,
            hours: b.hours,
            sortOrder: i,
          })),
        }),
    );

    summary.petAdjustments = await seedIfEmpty(
      prisma.petAdjustment.count({ where: { organizationId: orgId } }),
      () =>
        prisma.petAdjustment.createMany({
          data: D.PET_ADJUSTMENTS.map((p, i) => ({
            organizationId: orgId,
            key: p.key,
            label: p.label,
            hours: p.hours,
            sortOrder: i,
          })),
        }),
    );

    summary.featureOptions = await seedIfEmpty(
      prisma.featureOption.count({ where: { organizationId: orgId } }),
      () =>
        prisma.featureOption.createMany({
          data: D.FEATURE_OPTIONS.map((f, i) => ({
            organizationId: orgId,
            key: f.key,
            label: f.label,
            hours: f.hours,
            sortOrder: i,
          })),
        }),
    );

    summary.occupancyMultipliers = await seedIfEmpty(
      prisma.occupancyMultiplier.count({ where: { organizationId: orgId } }),
      () =>
        prisma.occupancyMultiplier.createMany({
          data: D.OCCUPANCY_MULTIPLIERS.map((m, i) => ({
            organizationId: orgId,
            key: m.key,
            label: m.label,
            multiplier: m.multiplier,
            sortOrder: i,
          })),
        }),
    );

    summary.flooringMultipliers = await seedIfEmpty(
      prisma.flooringMultiplier.count({ where: { organizationId: orgId } }),
      () =>
        prisma.flooringMultiplier.createMany({
          data: D.FLOORING_MULTIPLIERS.map((m, i) => ({
            organizationId: orgId,
            key: m.key,
            label: m.label,
            multiplier: m.multiplier,
            sortOrder: i,
          })),
        }),
    );

    summary.conditionMultipliers = await seedIfEmpty(
      prisma.conditionMultiplier.count({ where: { organizationId: orgId } }),
      () =>
        prisma.conditionMultiplier.createMany({
          data: D.CONDITION_MULTIPLIERS.map((m, i) => ({
            organizationId: orgId,
            key: m.key,
            label: m.label,
            multiplier: m.multiplier,
            sortOrder: i,
          })),
        }),
    );

    summary.frequencyMultipliers = await seedIfEmpty(
      prisma.frequencyMultiplier.count({ where: { organizationId: orgId } }),
      () =>
        prisma.frequencyMultiplier.createMany({
          data: D.FREQUENCY_MULTIPLIERS.map((f, i) => ({
            organizationId: orgId,
            key: f.key,
            label: f.label,
            multiplier: f.multiplier,
            visitsPerMonth: f.visitsPerMonth,
            isOneTime: f.isOneTime,
            isDeepClean: f.isDeepClean,
            sortOrder: i,
          })),
        }),
    );

    summary.marketTiers = await seedIfEmpty(
      prisma.marketTier.count({ where: { organizationId: orgId } }),
      () =>
        prisma.marketTier.createMany({
          data: D.MARKET_TIERS.map((t, i) => ({
            organizationId: orgId,
            key: t.key,
            label: t.label,
            hourlyRate: t.hourlyRate,
            minimumCharge: t.minimumCharge,
            isProvisional: t.isProvisional,
            sortOrder: i,
          })),
        }),
    );

    summary.zipTierMappings = await seedIfEmpty(
      prisma.zipTierMapping.count({ where: { organizationId: orgId } }),
      () =>
        prisma.zipTierMapping.createMany({
          data: D.ZIP_TIER_MAPPINGS.map((z) => ({
            organizationId: orgId,
            zip: z.zip,
            tierKey: z.tierKey,
            isProvisional: z.isProvisional,
          })),
        }),
    );

    summary.addOns = await seedIfEmpty(
      prisma.addOn.count({ where: { organizationId: orgId } }),
      () =>
        prisma.addOn.createMany({
          data: D.ADD_ONS.map((a, i) => ({
            organizationId: orgId,
            key: a.key,
            label: a.label,
            price: a.price,
            unit: a.unit,
            category: a.category as ServiceCategory,
            sortOrder: i,
          })),
        }),
    );

    summary.travelBrackets = await seedIfEmpty(
      prisma.travelBracket.count({ where: { organizationId: orgId } }),
      () =>
        prisma.travelBracket.createMany({
          data: D.TRAVEL_BRACKETS.map((t, i) => ({
            organizationId: orgId,
            minMiles: t.minMiles,
            maxMiles: t.maxMiles,
            fee: t.fee,
            requiresManualReview: t.requiresManualReview,
            sortOrder: i,
          })),
        }),
    );

    summary.taxRates = await seedIfEmpty(
      prisma.taxRate.count({ where: { organizationId: orgId } }),
      () =>
        prisma.taxRate.createMany({
          data: D.TAX_RATES.map((t) => ({
            organizationId: orgId,
            jurisdiction: t.jurisdiction,
            rate: t.rate,
            isDefault: t.isDefault,
            isProvisional: t.isProvisional,
          })),
        }),
    );

    summary.serviceTypes = await seedIfEmpty(
      prisma.serviceTypeConfig.count({ where: { organizationId: orgId } }),
      () =>
        prisma.serviceTypeConfig.createMany({
          data: D.SERVICE_TYPES.map((s) => ({
            organizationId: orgId,
            key: s.key as ServiceCategory,
            label: s.label,
            taxable: s.taxable,
          })),
        }),
    );

    summary.propertyTypes = await seedIfEmpty(
      prisma.propertyType.count({ where: { organizationId: orgId } }),
      () =>
        prisma.propertyType.createMany({
          data: D.PROPERTY_TYPES.map((p, i) => ({
            organizationId: orgId,
            key: p.key,
            label: p.label,
            multiplier: p.multiplier,
            sortOrder: i,
          })),
        }),
    );

    summary.pricingSettings = await seedIfEmpty(
      prisma.pricingSetting.count({ where: { organizationId: orgId } }),
      () =>
        prisma.pricingSetting.createMany({
          data: D.PRICING_SETTINGS.map((s) => ({
            organizationId: orgId,
            key: s.key,
            value: s.value,
            valueType: s.valueType,
            description: s.description,
          })),
        }),
    );

    // MarginConfig — single row per org (ADMIN-ONLY). Upsert.
    await prisma.marginConfig.upsert({
      where: { organizationId: orgId },
      update: {
        laborCostPerHour: D.MARGIN_CONFIG.laborCostPerHour,
        suppliesPerVisit: D.MARGIN_CONFIG.suppliesPerVisit,
        targetLaborPct: D.MARGIN_CONFIG.targetLaborPct,
        laborBandMin: D.MARGIN_CONFIG.laborBandMin,
        laborBandMax: D.MARGIN_CONFIG.laborBandMax,
      },
      create: {
        organizationId: orgId,
        laborCostPerHour: D.MARGIN_CONFIG.laborCostPerHour,
        suppliesPerVisit: D.MARGIN_CONFIG.suppliesPerVisit,
        targetLaborPct: D.MARGIN_CONFIG.targetLaborPct,
        laborBandMin: D.MARGIN_CONFIG.laborBandMin,
        laborBandMax: D.MARGIN_CONFIG.laborBandMax,
      },
    });
    summary.marginConfig = 1;

    console.log("✔ Pricing tables seeded (rows per table):");
    console.table(summary);
    console.log("\nSeed complete. Sign in at /login with:");
    console.log(`  email:    ${adminEmail}`);
    console.log("  password: (the SEED_ADMIN_PASSWORD you set)\n");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("\n✖ Seed failed:");
  console.error(err);
  process.exit(1);
});
