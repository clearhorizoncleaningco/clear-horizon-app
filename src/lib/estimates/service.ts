import "server-only";

/**
 * Estimate persistence (Phase 2) — save & retrieve quotes (BUILD_SPEC §G).
 *
 * The engine is re-run SERVER-SIDE from the org's DB pricing config (never trust
 * a client-computed price), then the input + full result are frozen as JSON
 * snapshots so a saved quote can't drift when Admin later edits pricing. Headline
 * columns are denormalized for fast listing + Phase 3 dashboards.
 */
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import {
  computeCommercialQuote,
  computeResidentialQuote,
  type CommercialQuoteResult,
  type ResidentialQuoteInput,
  type ResidentialQuoteResult,
} from "@/lib/pricing";
import { loadPricingConfig } from "@/lib/quotes/pricing-config";
import { resolveCustomerForEstimate } from "@/lib/customers/service";
import type { SaveCommercialEstimateDTO, SaveResidentialEstimateDTO } from "@/lib/quotes/schema";

export interface SaveContext {
  organizationId: string;
  userId?: string | null;
  userEmail?: string | null;
}

function residentialSummary(input: ResidentialQuoteInput, result: ResidentialQuoteResult): string {
  return `${input.sqft.toLocaleString("en-US")} sq ft · ${input.bedrooms} bd / ${input.bathrooms} ba · ${result.marketTier.label}`;
}

/** Save a residential estimate. Returns the new estimate id. */
export async function saveResidentialEstimate(
  ctx: SaveContext,
  dto: SaveResidentialEstimateDTO,
): Promise<string> {
  const config = await loadPricingConfig(ctx.organizationId);
  const { customer, ...rawInput } = dto;
  const input: ResidentialQuoteInput = { ...rawInput, quoteDate: new Date() };
  const result = computeResidentialQuote(input, config);

  const customerId = await resolveCustomerForEstimate(ctx.organizationId, customer, "Residential");

  const estimate = await prisma.estimate.create({
    data: {
      organizationId: ctx.organizationId,
      customerId,
      category: "Residential",
      status: "Saved",
      inputJson: input as unknown as Prisma.InputJsonValue,
      resultJson: result as unknown as Prisma.InputJsonValue,
      summary: residentialSummary(input, result),
      headlinePrice: result.primary.preTaxPrice,
      total: result.primary.total,
      frequencyKey: result.primary.frequencyKey,
      frequencyLabel: result.primary.frequencyLabel,
      isRecurring: result.isRecurring,
      projectedMonthly: result.projectedMonthly ?? null,
      initialDeepCleanPrice: result.initialDeepClean?.preTaxPrice ?? null,
      createdById: ctx.userId ?? null,
      createdByEmail: ctx.userEmail ?? null,
    },
    select: { id: true },
  });
  return estimate.id;
}

/** Save a manual commercial quote (§E.8). Returns the new estimate id. */
export async function saveCommercialEstimate(
  ctx: SaveContext,
  dto: SaveCommercialEstimateDTO,
): Promise<string> {
  const config = await loadPricingConfig(ctx.organizationId);
  const result = computeCommercialQuote(
    {
      basePrice: dto.basePrice,
      lineItems: dto.lineItems,
      taxableOverride: dto.taxableOverride ?? null,
    },
    config,
  );

  // Commercial customer name may be in the dedicated field; merge into customer info.
  const customer = { ...dto.customer, name: dto.customer.name ?? dto.customerName ?? null };
  const customerId = await resolveCustomerForEstimate(ctx.organizationId, customer, "Commercial");

  const inputSnapshot = {
    basePrice: dto.basePrice,
    lineItems: dto.lineItems,
    frequencyLabel: dto.frequencyLabel ?? null,
    scopeNotes: dto.scopeNotes ?? null,
    taxableOverride: dto.taxableOverride ?? null,
    customerName: customer.name,
  };

  const estimate = await prisma.estimate.create({
    data: {
      organizationId: ctx.organizationId,
      customerId,
      category: "Commercial",
      status: "Saved",
      inputJson: inputSnapshot as unknown as Prisma.InputJsonValue,
      resultJson: result as unknown as Prisma.InputJsonValue,
      summary: `Commercial · ${dto.frequencyLabel?.trim() || "manual quote"}`,
      headlinePrice: result.total,
      total: result.total,
      frequencyKey: null,
      frequencyLabel: dto.frequencyLabel?.trim() || null,
      isRecurring: false,
      projectedMonthly: null,
      initialDeepCleanPrice: null,
      createdById: ctx.userId ?? null,
      createdByEmail: ctx.userEmail ?? null,
    },
    select: { id: true },
  });
  return estimate.id;
}

export async function getEstimate(organizationId: string, id: string) {
  return prisma.estimate.findFirst({
    where: { id, organizationId },
    include: {
      customer: true,
      proposals: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function listEstimates(organizationId: string, limit = 100) {
  return prisma.estimate.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { customer: { select: { id: true, name: true } }, proposals: { select: { id: true, status: true } } },
  });
}

/** Typed views of the stored JSON snapshots (the engine emits plain numbers). */
export function readResidentialResult(json: Prisma.JsonValue): ResidentialQuoteResult {
  return json as unknown as ResidentialQuoteResult;
}
export function readCommercialResult(json: Prisma.JsonValue): CommercialQuoteResult {
  return json as unknown as CommercialQuoteResult;
}
