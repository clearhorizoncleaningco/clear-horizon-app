import "server-only";

/**
 * Customer persistence (Phase 2) — thin, ALWAYS org-scoped (CLAUDE.md §3.3).
 * Pure matching logic lives in dedupe.ts; this file only talks to Prisma.
 */
import { prisma } from "@/lib/db";
import type { Customer, ServiceCategory } from "@/generated/prisma/client";
import {
  findDuplicateCandidates,
  normalizePhone,
  type CustomerLike,
  type DuplicateCandidate,
  type DuplicateQuery,
} from "./dedupe";
import type { CustomerInfoDTO } from "@/lib/quotes/schema";

/** Max customers scanned for duplicate detection / dropdown search (SMB scale). */
const SCAN_LIMIT = 500;

export interface CustomerListItem {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  zip: string | null;
  type: ServiceCategory;
}

function toListItem(c: Customer): CustomerListItem {
  return { id: c.id, name: c.name, email: c.email, phone: c.phone, city: c.city, zip: c.zip, type: c.type };
}

function toCustomerLike(c: Customer): CustomerLike {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    phoneNormalized: c.phoneNormalized,
    address: c.address,
    city: c.city,
    zip: c.zip,
  };
}

/** Free-text search across name / email / phone (digits), newest first. */
export async function searchCustomers(
  organizationId: string,
  query: string,
  limit = 25,
): Promise<CustomerListItem[]> {
  const q = query.trim();
  if (!q) {
    const recent = await prisma.customer.findMany({
      where: { organizationId },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });
    return recent.map(toListItem);
  }

  const phoneDigits = normalizePhone(q);
  const rows = await prisma.customer.findMany({
    where: {
      organizationId,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        ...(phoneDigits.length >= 3 ? [{ phoneNormalized: { contains: phoneDigits } }] : []),
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
  return rows.map(toListItem);
}

/** Rank existing customers as possible duplicates of the given query (§F). */
export async function findCustomerDuplicates(
  organizationId: string,
  query: DuplicateQuery,
): Promise<DuplicateCandidate[]> {
  if (!query.name && !query.email && !query.phone) return [];
  const rows = await prisma.customer.findMany({
    where: { organizationId },
    orderBy: { updatedAt: "desc" },
    take: SCAN_LIMIT,
  });
  return findDuplicateCandidates(rows.map(toCustomerLike), query);
}

export async function getCustomer(organizationId: string, id: string) {
  return prisma.customer.findFirst({
    where: { id, organizationId },
    include: { estimates: { orderBy: { createdAt: "desc" } } },
  });
}

export async function createCustomer(
  organizationId: string,
  data: CustomerInfoDTO,
  type: ServiceCategory,
): Promise<Customer> {
  return prisma.customer.create({
    data: {
      organizationId,
      type,
      name: data.name?.trim() || "Unnamed customer",
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
      phoneNormalized: data.phone ? normalizePhone(data.phone) || null : null,
      address: data.address?.trim() || null,
      city: data.city?.trim() || null,
      zip: data.zip?.trim() || null,
      notes: data.notes?.trim() || null,
    },
  });
}

/**
 * Resolve the customer to attach to a quote:
 *  - explicit `customerId` (rep linked an existing record) → verify org + use it
 *  - else a name was entered → create a new customer
 *  - else → null (anonymous quote; customer info just rides along)
 */
export async function resolveCustomerForEstimate(
  organizationId: string,
  data: CustomerInfoDTO,
  type: ServiceCategory,
): Promise<string | null> {
  if (data.customerId) {
    const existing = await prisma.customer.findFirst({
      where: { id: data.customerId, organizationId },
      select: { id: true },
    });
    if (existing) return existing.id;
  }
  if (data.name?.trim()) {
    const created = await createCustomer(organizationId, data, type);
    return created.id;
  }
  return null;
}
