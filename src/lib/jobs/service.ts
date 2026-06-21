import "server-only";

/**
 * Job persistence (Phase 3, BUILD_SPEC §G) — create jobs from saved estimates,
 * assign + track them, log the calibration actuals, attach before/after photos,
 * and publish the customer photo report. ALWAYS org-scoped (CLAUDE.md §3.3).
 *
 * Mechanical only: pure calibration/earnings/report math lives in the pure
 * modules (compute.ts, earnings.ts, report.ts); role gating lives in the server
 * actions. This file just talks to Prisma (and storage for photo cleanup).
 */
import { prisma } from "@/lib/db";
import type { JobStatus, Prisma } from "@/generated/prisma/client";
import type { ResidentialQuoteResult } from "@/lib/pricing";
import { deleteJobPhotoObject } from "./storage";

type DecimalLike = { toNumber(): number };
const num = (d: DecimalLike | null | undefined): number | null => (d == null ? null : d.toNumber());

export interface JobActor {
  organizationId: string;
  userId?: string | null;
  userEmail?: string | null;
}

/**
 * Convert a saved estimate into a trackable job (BUILD_SPEC §F "Convert to Job").
 * Snapshots the customer + the estimated economics so the job is self-contained.
 * Returns an existing active job for the estimate if one already exists (so the
 * button is idempotent rather than spawning duplicates).
 */
export async function createJobFromEstimate(actor: JobActor, estimateId: string): Promise<string> {
  const estimate = await prisma.estimate.findFirst({
    where: { id: estimateId, organizationId: actor.organizationId },
    include: { customer: true },
  });
  if (!estimate) throw new Error("Estimate not found.");

  const existing = await prisma.job.findFirst({
    where: { organizationId: actor.organizationId, estimateId, status: { not: "Cancelled" } },
    select: { id: true },
  });
  if (existing) return existing.id;

  // Estimated economics for the calibration baseline (residential only; the
  // commercial path has no engine, so production hours / labor cost are null).
  let estProductionHours: number | null = null;
  let estLaborCost: number | null = null;
  if (estimate.category === "Residential") {
    const result = estimate.resultJson as unknown as ResidentialQuoteResult;
    estProductionHours = result.primary?.productionHours ?? null;
    estLaborCost = result.primary?.margin?.estimatedLaborCost ?? null;
  }

  const inputJson = (estimate.inputJson ?? {}) as { customerName?: string | null };
  const customerName = estimate.customer?.name ?? inputJson.customerName ?? null;

  const job = await prisma.job.create({
    data: {
      organizationId: actor.organizationId,
      estimateId: estimate.id,
      customerId: estimate.customerId,
      category: estimate.category,
      status: "Scheduled",
      summary: estimate.summary,
      customerName,
      address: estimate.customer?.address ?? null,
      city: estimate.customer?.city ?? null,
      zip: estimate.customer?.zip ?? null,
      quotedPrice: num(estimate.headlinePrice) ?? 0,
      estProductionHours,
      estLaborCost,
      createdById: actor.userId ?? null,
      createdByEmail: actor.userEmail ?? null,
    },
    select: { id: true },
  });
  return job.id;
}

const jobInclude = {
  customer: { select: { id: true, name: true, email: true, phone: true } },
  photos: { orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }] },
} satisfies Prisma.JobInclude;

export async function getJob(organizationId: string, id: string) {
  return prisma.job.findFirst({ where: { id, organizationId }, include: jobInclude });
}

/** Public lookup by unguessable report token (customer photo report — no auth). */
export async function getJobByReportToken(token: string) {
  if (!token) return null;
  return prisma.job.findUnique({
    where: { reportToken: token },
    include: {
      organization: { select: { name: true, contactEmail: true, contactPhone: true, website: true } },
      photos: { orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }] },
    },
  });
}

export interface ListJobsOptions {
  status?: JobStatus;
  assignedToId?: string;
  limit?: number;
}

export async function listJobs(organizationId: string, opts: ListJobsOptions = {}) {
  return prisma.job.findMany({
    where: {
      organizationId,
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.assignedToId ? { assignedToId: opts.assignedToId } : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    take: opts.limit ?? 200,
    include: { customer: { select: { id: true, name: true } }, _count: { select: { photos: true } } },
  });
}

/** Profiles in the org that a job can be assigned to (Cleaner view). */
export async function listAssignableProfiles(organizationId: string) {
  return prisma.profile.findMany({
    where: { organizationId },
    orderBy: [{ role: "asc" }, { email: "asc" }],
    select: { id: true, email: true, fullName: true, role: true },
  });
}

export async function assignJob(
  organizationId: string,
  jobId: string,
  assignedToId: string | null,
  scheduledFor: Date | null,
): Promise<void> {
  let assignedToName: string | null = null;
  let assignedToEmail: string | null = null;
  if (assignedToId) {
    const profile = await prisma.profile.findFirst({
      where: { id: assignedToId, organizationId },
      select: { fullName: true, email: true },
    });
    if (!profile) throw new Error("That team member isn't in your organization.");
    assignedToName = profile.fullName ?? profile.email;
    assignedToEmail = profile.email;
  }
  await prisma.job.updateMany({
    where: { id: jobId, organizationId },
    data: { assignedToId, assignedToName, assignedToEmail, scheduledFor },
  });
}

/** Move a job through its lifecycle, stamping start/complete times. */
export async function setJobStatus(
  organizationId: string,
  jobId: string,
  status: JobStatus,
): Promise<void> {
  const now = new Date();
  const data: Prisma.JobUpdateManyMutationInput = { status };
  if (status === "InProgress") data.startedAt = now;
  if (status === "Completed") data.completedAt = now;
  await prisma.job.updateMany({ where: { id: jobId, organizationId }, data });
}

export interface CalibrationActuals {
  priceCharged: number | null;
  actualCrewHours: number | null;
  actualLaborCost: number | null;
  actualSuppliesCost: number | null;
  cleanerPayAmount: number | null;
  calibrationNotes: string | null;
}

/** Log the calibration actuals for a job (ADMIN-only at the action layer). */
export async function logCalibration(
  organizationId: string,
  jobId: string,
  actuals: CalibrationActuals,
): Promise<void> {
  await prisma.job.updateMany({
    where: { id: jobId, organizationId },
    data: {
      priceCharged: actuals.priceCharged,
      actualCrewHours: actuals.actualCrewHours,
      actualLaborCost: actuals.actualLaborCost,
      actualSuppliesCost: actuals.actualSuppliesCost,
      cleanerPayAmount: actuals.cleanerPayAmount,
      calibrationNotes: actuals.calibrationNotes,
      calibratedAt: new Date(),
    },
  });
}

export async function setReportPublished(
  organizationId: string,
  jobId: string,
  published: boolean,
): Promise<void> {
  await prisma.job.updateMany({
    where: { id: jobId, organizationId },
    data: { reportPublished: published },
  });
}

export interface AddPhotoInput {
  kind: "Before" | "After";
  storagePath: string;
  caption?: string | null;
  room?: string | null;
}

export async function addJobPhoto(
  actor: JobActor,
  jobId: string,
  input: AddPhotoInput,
): Promise<void> {
  // Verify the job is in the actor's org before attaching (defense in depth).
  const job = await prisma.job.findFirst({
    where: { id: jobId, organizationId: actor.organizationId },
    select: { id: true, photos: { select: { id: true }, where: { kind: input.kind } } },
  });
  if (!job) throw new Error("Job not found.");

  await prisma.jobPhoto.create({
    data: {
      organizationId: actor.organizationId,
      jobId,
      kind: input.kind,
      storagePath: input.storagePath,
      caption: input.caption?.trim() || null,
      room: input.room?.trim() || null,
      sortOrder: job.photos.length,
      uploadedById: actor.userId ?? null,
      uploadedByEmail: actor.userEmail ?? null,
    },
  });
}

export async function deleteJobPhoto(organizationId: string, photoId: string): Promise<void> {
  const photo = await prisma.jobPhoto.findFirst({
    where: { id: photoId, organizationId },
    select: { id: true, storagePath: true },
  });
  if (!photo) return;
  await prisma.jobPhoto.delete({ where: { id: photo.id } });
  await deleteJobPhotoObject(photo.storagePath);
}

/** Plain-number view of a job's economics for the calibration math. */
export function jobEconomics(job: {
  quotedPrice: DecimalLike;
  estProductionHours: DecimalLike | null;
  estLaborCost: DecimalLike | null;
  priceCharged: DecimalLike | null;
  actualCrewHours: DecimalLike | null;
  actualLaborCost: DecimalLike | null;
  actualSuppliesCost: DecimalLike | null;
}) {
  return {
    quotedPrice: num(job.quotedPrice) ?? 0,
    estProductionHours: num(job.estProductionHours),
    estLaborCost: num(job.estLaborCost),
    priceCharged: num(job.priceCharged),
    actualCrewHours: num(job.actualCrewHours),
    actualLaborCost: num(job.actualLaborCost),
    actualSuppliesCost: num(job.actualSuppliesCost),
  };
}
