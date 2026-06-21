import "server-only";

/**
 * Audit log persistence (Phase 3, BUILD_SPEC §G — "audit logs on pricing
 * changes"). Append-only, org-scoped. The pricing server actions call
 * `recordPricingChanges` after a successful edit; the Admin audit page lists them.
 */
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { describeChange, type FieldChange } from "./diff";

export interface AuditActor {
  organizationId: string;
  userId?: string | null;
  userEmail?: string | null;
}

/** Write one AuditLog row per changed pricing field. No-op when nothing changed. */
export async function recordPricingChanges(
  actor: AuditActor,
  changes: FieldChange[],
): Promise<void> {
  if (changes.length === 0) return;
  const data: Prisma.AuditLogCreateManyInput[] = changes.map((c) => ({
    organizationId: actor.organizationId,
    actorId: actor.userId ?? null,
    actorEmail: actor.userEmail ?? null,
    category: "Pricing",
    entity: c.entity,
    entityLabel: c.entityLabel ?? null,
    field: c.field,
    action: "update",
    oldValue: c.oldValue,
    newValue: c.newValue,
    summary: describeChange(c),
  }));
  await prisma.auditLog.createMany({ data });
}

export async function listAuditLogs(organizationId: string, limit = 200) {
  return prisma.auditLog.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
