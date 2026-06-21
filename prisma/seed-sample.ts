/**
 * Phase 3 SAMPLE/DEMO data — run with `npm run db:seed:sample` (after `db:seed`).
 *
 * Creates a Cleaner user + a handful of customers, estimates (across cities,
 * frequencies and statuses), and jobs — several completed with calibration
 * actuals and before/after photos, one with a PUBLISHED customer report. This
 * makes the dashboard, reports, calibration loop and a real photo report show
 * live data for the §G checkpoint.
 *
 * Idempotent: it tags everything it creates and exits early if already present,
 * so re-running never duplicates. Clearly DEMO data — delete in Prisma Studio
 * when you start logging real jobs. Uses RELATIVE imports (runs under tsx).
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PrismaClient } from "../src/generated/prisma/client";
import { buildConfigFromDefaults } from "../src/lib/pricing/config-from-defaults";
import { computeResidentialQuote } from "../src/lib/pricing/engine";
import type { ResidentialQuoteInput } from "../src/lib/pricing/types";

const DEMO_TAG = "demo-seed";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.startsWith("placeholder")) {
    throw new Error(`Missing/placeholder env var: ${name}. Fill in real Supabase values in .env.`);
  }
  return value;
}

async function findUserByEmail(supabase: SupabaseClient, email: string): Promise<string | null> {
  const perPage = 200;
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match.id;
    if (data.users.length < perPage) return null;
  }
}

async function ensureCleaner(supabase: SupabaseClient, email: string, password: string, fullName: string): Promise<string> {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role: "Cleaner" },
  });
  if (data?.user) return data.user.id;
  if (error && /already|registered|exists/i.test(error.message)) {
    const id = await findUserByEmail(supabase, email);
    if (id) {
      await supabase.auth.admin.updateUserById(id, { password, user_metadata: { full_name: fullName, role: "Cleaner" } });
      return id;
    }
  }
  throw new Error(`Failed to create cleaner user: ${error?.message ?? "unknown error"}`);
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

interface Scenario {
  customer: { name: string; email: string; phone: string; address: string; city: string; zip: string };
  input: ResidentialQuoteInput;
  status: "Saved" | "Proposed" | "Approved" | "Declined";
  createdDaysAgo: number;
  job?: {
    assign: boolean;
    status: "Scheduled" | "InProgress" | "Completed";
    completedDaysAgo?: number;
    priceCharged?: number;
    actualCrewHours?: number;
    cleanerPayAmount?: number;
    publishReport?: boolean;
    photos?: { kind: "Before" | "After"; storagePath: string; caption: string; room: string }[];
  };
}

const PHOTOS_A = [
  { kind: "Before" as const, storagePath: "/brand/04_alt_stacked_1.png", caption: "Kitchen — before", room: "Kitchen" },
  { kind: "Before" as const, storagePath: "/brand/brandmark_icon_exact_2.png", caption: "Primary bath — before", room: "Bath" },
  { kind: "After" as const, storagePath: "/brand/05_alt_circular_badge_3.png", caption: "Kitchen — after", room: "Kitchen" },
  { kind: "After" as const, storagePath: "/brand/facebook_profile_1080x1080_3.png", caption: "Primary bath — after", room: "Bath" },
];

const base = (over: Partial<ResidentialQuoteInput>): ResidentialQuoteInput => ({
  sqft: 2200,
  bedrooms: 3,
  bathrooms: 2.5,
  occupancyKey: "Couple",
  flooringKey: "Tile",
  conditionKey: "Average",
  petKey: "One",
  featureKeys: [],
  frequencyKey: "Biweekly",
  addOns: [],
  seasonalOverride: null,
  ...over,
});

const SCENARIOS: Scenario[] = [
  {
    customer: { name: "Jane Doe", email: "jane.doe@example.com", phone: "(239) 555-0100", address: "123 Gulf Shore Blvd", city: "Naples", zip: "34102" },
    input: base({ marketTierKeyOverride: "Naples", frequencyKey: "Biweekly", featureKeys: ["Lanai"] }),
    status: "Approved",
    createdDaysAgo: 6,
    job: { assign: true, status: "Completed", completedDaysAgo: 2, priceCharged: 500, actualCrewHours: 6, cleanerPayAmount: 132, publishReport: true, photos: PHOTOS_A },
  },
  {
    customer: { name: "Robert Smith", email: "rob.smith@example.com", phone: "(239) 555-0111", address: "88 5th Ave S", city: "Naples", zip: "34102" },
    input: base({ marketTierKeyOverride: "LuxuryNaples", frequencyKey: "Weekly", sqft: 3200, bedrooms: 4, bathrooms: 3.5, occupancyKey: "Family", flooringKey: "LuxuryMixed", conditionKey: "Average" }),
    status: "Approved",
    createdDaysAgo: 20,
    job: { assign: true, status: "Completed", completedDaysAgo: 5, priceCharged: 825, actualCrewHours: 14, cleanerPayAmount: 308, publishReport: false, photos: PHOTOS_A.slice(0, 3) },
  },
  {
    customer: { name: "Maria Garcia", email: "maria.g@example.com", phone: "(239) 555-0122", address: "742 Vanderbilt Beach Rd", city: "Fort Myers", zip: "33908" },
    input: base({ marketTierKeyOverride: "FortMyers", frequencyKey: "Monthly", sqft: 1800, bedrooms: 3, bathrooms: 2, conditionKey: "Dirty" }),
    status: "Proposed",
    createdDaysAgo: 3,
    job: { assign: true, status: "InProgress" },
  },
  {
    customer: { name: "David Brown", email: "dave.b@example.com", phone: "(239) 555-0133", address: "12 Marco Pkwy", city: "Marco Island", zip: "34145" },
    input: base({ marketTierKeyOverride: "Naples", frequencyKey: "OneTimeDeep", sqft: 2600, bedrooms: 4, bathrooms: 3, conditionKey: "VeryDirty" }),
    status: "Approved",
    createdDaysAgo: 40,
    job: { assign: true, status: "Completed", completedDaysAgo: 33, priceCharged: 700, actualCrewHours: 12, cleanerPayAmount: 264, publishReport: true, photos: PHOTOS_A },
  },
  {
    customer: { name: "Linda Wilson", email: "linda.w@example.com", phone: "(239) 555-0144", address: "300 Bonita Beach Rd", city: "Bonita Springs", zip: "34134" },
    input: base({ marketTierKeyOverride: "Naples", frequencyKey: "Biweekly", sqft: 2000, bedrooms: 3, bathrooms: 2 }),
    status: "Declined",
    createdDaysAgo: 50,
  },
  {
    customer: { name: "Tom Anderson", email: "tom.a@example.com", phone: "(239) 555-0155", address: "55 Estero Blvd", city: "Estero", zip: "33928" },
    input: base({ marketTierKeyOverride: "FortMyers", frequencyKey: "Weekly", sqft: 1500, bedrooms: 2, bathrooms: 2 }),
    status: "Saved",
    createdDaysAgo: 1,
    job: { assign: true, status: "Scheduled" },
  },
];

async function main() {
  const databaseUrl = requireEnv("DATABASE_URL");
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const orgSlug = process.env.SEED_ORG_SLUG ?? "clear-horizon";
  const cleanerEmail = process.env.SEED_CLEANER_EMAIL ?? "cleaner@clearhorizoncleaners.com";
  const cleanerPassword = process.env.SEED_CLEANER_PASSWORD ?? requireEnv("SEED_ADMIN_PASSWORD");
  const cleanerName = process.env.SEED_CLEANER_NAME ?? "Sam Cleaner";

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    const org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
    if (!org) throw new Error(`Organization "${orgSlug}" not found. Run \`npm run db:seed\` first.`);
    const orgId = org.id;

    const already = await prisma.job.count({ where: { organizationId: orgId, createdByEmail: DEMO_TAG } });
    if (already > 0) {
      console.log(`✔ Demo data already present (${already} demo jobs). Nothing to do.`);
      return;
    }

    // Cleaner user + profile.
    const cleanerId = await ensureCleaner(supabase, cleanerEmail, cleanerPassword, cleanerName);
    await prisma.profile.upsert({
      where: { id: cleanerId },
      update: { email: cleanerEmail, fullName: cleanerName, role: "Cleaner", organizationId: orgId },
      create: { id: cleanerId, email: cleanerEmail, fullName: cleanerName, role: "Cleaner", organizationId: orgId },
    });
    console.log(`✔ Cleaner profile: ${cleanerEmail}`);

    const config = buildConfigFromDefaults();
    let estimates = 0;
    let jobs = 0;
    let photos = 0;

    for (const sc of SCENARIOS) {
      const customer = await prisma.customer.create({
        data: {
          organizationId: orgId,
          type: "Residential",
          name: sc.customer.name,
          email: sc.customer.email,
          phone: sc.customer.phone,
          phoneNormalized: sc.customer.phone.replace(/\D/g, ""),
          address: sc.customer.address,
          city: sc.customer.city,
          zip: sc.customer.zip,
          notes: DEMO_TAG,
        },
      });

      const input = { ...sc.input, quoteDate: daysAgo(sc.createdDaysAgo) };
      const result = computeResidentialQuote(input, config);
      const createdAt = daysAgo(sc.createdDaysAgo);

      const estimate = await prisma.estimate.create({
        data: {
          organizationId: orgId,
          customerId: customer.id,
          category: "Residential",
          status: sc.status,
          inputJson: input as unknown as object,
          resultJson: result as unknown as object,
          summary: `${input.sqft.toLocaleString("en-US")} sq ft · ${input.bedrooms} bd / ${input.bathrooms} ba · ${result.marketTier.label}`,
          headlinePrice: result.primary.preTaxPrice,
          total: result.primary.total,
          frequencyKey: result.primary.frequencyKey,
          frequencyLabel: result.primary.frequencyLabel,
          isRecurring: result.isRecurring,
          projectedMonthly: result.projectedMonthly ?? null,
          initialDeepCleanPrice: result.initialDeepClean?.preTaxPrice ?? null,
          createdByEmail: DEMO_TAG,
          createdAt,
          updatedAt: createdAt,
        },
      });
      estimates += 1;

      if (sc.job) {
        const completedAt = sc.job.status === "Completed" && sc.job.completedDaysAgo != null ? daysAgo(sc.job.completedDaysAgo) : null;
        const job = await prisma.job.create({
          data: {
            organizationId: orgId,
            estimateId: estimate.id,
            customerId: customer.id,
            category: "Residential",
            status: sc.job.status,
            summary: estimate.summary,
            customerName: customer.name,
            address: customer.address,
            city: customer.city,
            zip: customer.zip,
            assignedToId: sc.job.assign ? cleanerId : null,
            assignedToName: sc.job.assign ? cleanerName : null,
            assignedToEmail: sc.job.assign ? cleanerEmail : null,
            scheduledFor: daysAgo(sc.createdDaysAgo - 1),
            quotedPrice: result.primary.preTaxPrice,
            estProductionHours: result.primary.productionHours,
            estLaborCost: result.primary.margin.estimatedLaborCost,
            priceCharged: sc.job.priceCharged ?? null,
            actualCrewHours: sc.job.actualCrewHours ?? null,
            cleanerPayAmount: sc.job.cleanerPayAmount ?? null,
            calibratedAt: sc.job.priceCharged != null ? completedAt : null,
            reportPublished: sc.job.publishReport ?? false,
            startedAt: sc.job.status !== "Scheduled" ? daysAgo((sc.job.completedDaysAgo ?? sc.createdDaysAgo) + 1) : null,
            completedAt,
            createdByEmail: DEMO_TAG,
            createdAt,
            updatedAt: completedAt ?? createdAt,
          },
        });
        jobs += 1;

        if (sc.job.photos?.length) {
          await prisma.jobPhoto.createMany({
            data: sc.job.photos.map((p, i) => ({
              organizationId: orgId,
              jobId: job.id,
              kind: p.kind,
              storagePath: p.storagePath,
              caption: p.caption,
              room: p.room,
              sortOrder: i,
              uploadedByEmail: DEMO_TAG,
            })),
          });
          photos += sc.job.photos.length;
        }
      }
    }

    console.log(`✔ Created ${estimates} estimates, ${jobs} jobs, ${photos} photos (tagged "${DEMO_TAG}").`);
    const published = await prisma.job.findFirst({
      where: { organizationId: orgId, createdByEmail: DEMO_TAG, reportPublished: true },
      select: { reportToken: true },
    });
    if (published) {
      console.log(`\nPublished customer photo report: /report/${published.reportToken}`);
    }
    console.log(`Cleaner login: ${cleanerEmail} (password as set)\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("\n✖ Sample seed failed:");
  console.error(err);
  process.exit(1);
});
