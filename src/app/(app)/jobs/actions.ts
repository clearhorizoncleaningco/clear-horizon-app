"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { JobStatus, Role } from "@/generated/prisma/client";
import { requireProfile } from "@/lib/auth/dal";
import {
  addJobPhoto,
  assignJob,
  createJobFromEstimate,
  deleteJobPhoto,
  getJob,
  logCalibration,
  setJobStatus,
  setReportPublished,
  type JobActor,
} from "@/lib/jobs/service";
import { uploadJobPhoto, isStorageConfigured } from "@/lib/jobs/storage";

/**
 * Phase 3 job operations. Role gating lives here (the service stays mechanical):
 *   - Admin / Office Staff: create, assign, status, publish, photos on any job.
 *   - Cleaner: status + photos on jobs assigned to THEM only.
 *   - Calibration actuals (margin) are Admin-only (CLAUDE.md §3.5).
 */

async function actorAndRole(): Promise<{ actor: JobActor; role: Role }> {
  const { user, profile } = await requireProfile();
  if (!profile) throw new Error("Your account isn't linked to an organization yet.");
  return {
    actor: { organizationId: profile.organizationId, userId: user.id, userEmail: profile.email },
    role: profile.role,
  };
}

function assertManage(role: Role): void {
  if (role !== "Admin" && role !== "OfficeStaff") throw new Error("You don't have access to manage jobs.");
}
function assertAdmin(role: Role): void {
  if (role !== "Admin") throw new Error("Admin access required.");
}

/** Load the job and ensure the actor may act on it (cleaners: only if assigned). */
async function loadActionableJob(actor: JobActor, role: Role, jobId: string) {
  const job = await getJob(actor.organizationId, jobId);
  if (!job) throw new Error("Job not found.");
  if (role === "Cleaner" && job.assignedToId !== actor.userId) {
    throw new Error("This job isn't assigned to you.");
  }
  return job;
}

function optionalNumber(formData: FormData, name: string): number | null {
  const raw = String(formData.get(name) ?? "").trim();
  if (raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`"${name}" must be a number.`);
  return n;
}

// ---------------------------------------------------------------------------
export async function convertEstimateToJobAction(formData: FormData): Promise<void> {
  const { actor, role } = await actorAndRole();
  assertManage(role);
  const estimateId = String(formData.get("estimateId") ?? "");
  if (!estimateId) throw new Error("Missing estimate id.");
  const jobId = await createJobFromEstimate(actor, estimateId);
  revalidatePath(`/estimates/${estimateId}`);
  redirect(`/jobs/${jobId}`);
}

export async function assignJobAction(formData: FormData): Promise<void> {
  const { actor, role } = await actorAndRole();
  assertManage(role);
  const jobId = String(formData.get("jobId") ?? "");
  const assignedToId = String(formData.get("assignedToId") ?? "").trim() || null;
  const scheduledRaw = String(formData.get("scheduledFor") ?? "").trim();
  const scheduledFor = scheduledRaw ? new Date(scheduledRaw) : null;
  await assignJob(actor.organizationId, jobId, assignedToId, scheduledFor);
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
}

export async function setJobStatusAction(formData: FormData): Promise<void> {
  const { actor, role } = await actorAndRole();
  const jobId = String(formData.get("jobId") ?? "");
  const status = String(formData.get("status") ?? "") as JobStatus;
  if (!["Scheduled", "InProgress", "Completed", "Cancelled"].includes(status)) {
    throw new Error("Invalid status.");
  }
  await loadActionableJob(actor, role, jobId);
  await setJobStatus(actor.organizationId, jobId, status);
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
  revalidatePath("/cleaner");
  revalidatePath(`/cleaner/jobs/${jobId}`);
}

export async function logCalibrationAction(formData: FormData): Promise<void> {
  const { actor, role } = await actorAndRole();
  assertAdmin(role); // calibration surfaces margin — Admin only
  const jobId = String(formData.get("jobId") ?? "");
  await logCalibration(actor.organizationId, jobId, {
    priceCharged: optionalNumber(formData, "priceCharged"),
    actualCrewHours: optionalNumber(formData, "actualCrewHours"),
    actualLaborCost: optionalNumber(formData, "actualLaborCost"),
    actualSuppliesCost: optionalNumber(formData, "actualSuppliesCost"),
    cleanerPayAmount: optionalNumber(formData, "cleanerPayAmount"),
    calibrationNotes: String(formData.get("calibrationNotes") ?? "").trim() || null,
  });
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/calibration");
  revalidatePath("/dashboard");
}

export async function publishReportAction(formData: FormData): Promise<void> {
  const { actor, role } = await actorAndRole();
  assertManage(role);
  const jobId = String(formData.get("jobId") ?? "");
  const published = String(formData.get("published") ?? "") === "true";
  await setReportPublished(actor.organizationId, jobId, published);
  revalidatePath(`/jobs/${jobId}`);
}

export async function uploadJobPhotoAction(formData: FormData): Promise<void> {
  const { actor, role } = await actorAndRole();
  const jobId = String(formData.get("jobId") ?? "");
  await loadActionableJob(actor, role, jobId);

  if (!isStorageConfigured()) {
    throw new Error(
      "Photo storage isn't configured. Set SUPABASE_SERVICE_ROLE_KEY and run `npm run setup:storage`.",
    );
  }

  const kind = String(formData.get("kind") ?? "") as "Before" | "After";
  if (kind !== "Before" && kind !== "After") throw new Error("Photo must be tagged Before or After.");

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) throw new Error("Please choose a photo to upload.");
  const bytes = new Uint8Array(await file.arrayBuffer());

  const storagePath = await uploadJobPhoto({
    organizationId: actor.organizationId,
    jobId,
    kind,
    contentType: file.type,
    bytes,
  });
  await addJobPhoto(actor, jobId, {
    kind,
    storagePath,
    caption: String(formData.get("caption") ?? "").trim() || null,
    room: String(formData.get("room") ?? "").trim() || null,
  });

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/cleaner/jobs/${jobId}`);
}

export async function deleteJobPhotoAction(formData: FormData): Promise<void> {
  const { actor, role } = await actorAndRole();
  const jobId = String(formData.get("jobId") ?? "");
  const photoId = String(formData.get("photoId") ?? "");
  await loadActionableJob(actor, role, jobId);
  await deleteJobPhoto(actor.organizationId, photoId);
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/cleaner/jobs/${jobId}`);
}
