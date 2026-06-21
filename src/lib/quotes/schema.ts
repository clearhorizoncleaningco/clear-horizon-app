import { z } from "zod";

/**
 * Zod schemas for quote boundaries (CLAUDE.md §3.6 — validate at every boundary).
 * Pure (no `server-only`): used by the client to validate wizard state before
 * pricing, and by server actions on the commercial path.
 */

export const addOnSelectionSchema = z.object({
  key: z.string().min(1),
  quantity: z.number().int().min(0),
});

export const residentialQuoteInputSchema = z.object({
  sqft: z.number().positive("Square footage must be greater than 0"),
  bedrooms: z.number().int().min(0).max(50),
  bathrooms: z.number().min(0).max(50),
  zip: z.string().trim().max(10).optional().nullable(),
  marketTierKeyOverride: z.string().optional().nullable(),
  propertyTypeKey: z.string().optional().nullable(),
  occupancyKey: z.string().min(1),
  flooringKey: z.string().min(1),
  conditionKey: z.string().min(1),
  petKey: z.string().min(1),
  featureKeys: z.array(z.string()),
  frequencyKey: z.string().min(1),
  travelMiles: z.number().min(0).max(500).optional().nullable(),
  addOns: z.array(addOnSelectionSchema),
  seasonalOverride: z.enum(["peak", "off"]).optional().nullable(),
});

export type ResidentialQuoteInputDTO = z.infer<typeof residentialQuoteInputSchema>;

export const commercialLineItemSchema = z.object({
  description: z.string().trim().min(1, "Description required"),
  amount: z.number().min(0, "Amount must be ≥ 0"),
});

export const commercialQuoteInputSchema = z.object({
  customerName: z.string().trim().max(200).optional().nullable(),
  basePrice: z.number().min(0, "Base price must be ≥ 0"),
  frequencyLabel: z.string().trim().max(120).optional().nullable(),
  scopeNotes: z.string().trim().max(5000).optional().nullable(),
  lineItems: z.array(commercialLineItemSchema),
  taxableOverride: z.boolean().optional().nullable(),
});

export type CommercialQuoteInputDTO = z.infer<typeof commercialQuoteInputSchema>;

/**
 * Customer info captured alongside a quote (BUILD_SPEC §F step 1). Lenient on
 * format (email/phone are not strictly validated) so a rep can save a quote
 * mid-call with partial info; we only cap lengths. `customerId` is set when the
 * rep linked an existing customer from the duplicate-detection panel.
 */
export const customerInfoSchema = z.object({
  customerId: z.string().uuid().optional().nullable(),
  name: z.string().trim().max(200).optional().nullable(),
  email: z.string().trim().max(200).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  address: z.string().trim().max(300).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  zip: z.string().trim().max(10).optional().nullable(),
  notes: z.string().trim().max(5000).optional().nullable(),
});

export type CustomerInfoDTO = z.infer<typeof customerInfoSchema>;

/** Save payload for a residential estimate: the engine input + customer info. */
export const saveResidentialEstimateSchema = residentialQuoteInputSchema.extend({
  customer: customerInfoSchema,
});

export type SaveResidentialEstimateDTO = z.infer<typeof saveResidentialEstimateSchema>;

/** Save payload for a commercial quote: the manual quote + customer info. */
export const saveCommercialEstimateSchema = commercialQuoteInputSchema.extend({
  customer: customerInfoSchema,
});

export type SaveCommercialEstimateDTO = z.infer<typeof saveCommercialEstimateSchema>;
