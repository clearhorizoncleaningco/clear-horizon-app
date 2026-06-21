import "server-only";

import { randomUUID } from "node:crypto";
import { getSupabaseAdmin, isStorageConfigured } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env";

/**
 * Job before/after photo storage (BUILD_SPEC §G Phase 3). Photos live in a
 * Supabase Storage bucket; `JobPhoto.storagePath` holds the object key. A
 * leading "/" means a local /public asset (used by demo seed data) and is served
 * as-is — so the customer report renders demo photos without any cloud setup.
 *
 * Server-only: the upload path uses the service-role admin client.
 */
export const JOB_PHOTOS_BUCKET = "job-photos";

export { isStorageConfigured };

const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

export const MAX_PHOTO_BYTES = 12 * 1024 * 1024; // 12 MB

/** Map a stored path to a displayable URL (public bucket URL, or local asset). */
export function publicPhotoUrl(storagePath: string): string {
  if (storagePath.startsWith("/")) return storagePath; // local /public demo asset
  const base = publicEnv.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${JOB_PHOTOS_BUCKET}/${encodeURI(storagePath)}`;
}

export interface UploadJobPhotoParams {
  organizationId: string;
  jobId: string;
  kind: "Before" | "After";
  contentType: string;
  bytes: Uint8Array;
}

/** Upload one photo, returning its storage key. Validates type + size. */
export async function uploadJobPhoto(params: UploadJobPhotoParams): Promise<string> {
  const ext = ALLOWED_CONTENT_TYPES[params.contentType.toLowerCase()];
  if (!ext) {
    throw new Error("Unsupported image type. Please upload a JPG, PNG, WEBP, or HEIC.");
  }
  if (params.bytes.byteLength === 0) throw new Error("The selected file is empty.");
  if (params.bytes.byteLength > MAX_PHOTO_BYTES) {
    throw new Error("Image is too large (max 12 MB).");
  }

  const supabase = getSupabaseAdmin();
  const key = `${params.organizationId}/${params.jobId}/${params.kind.toLowerCase()}-${randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(JOB_PHOTOS_BUCKET)
    .upload(key, params.bytes, { contentType: params.contentType, upsert: false });
  if (error) throw new Error(`Photo upload failed: ${error.message}`);
  return key;
}

/** Remove a stored object (no-op for local demo assets). */
export async function deleteJobPhotoObject(storagePath: string): Promise<void> {
  if (storagePath.startsWith("/")) return;
  if (!isStorageConfigured()) return;
  const supabase = getSupabaseAdmin();
  await supabase.storage.from(JOB_PHOTOS_BUCKET).remove([storagePath]);
}

/** Idempotently create the public photo bucket (used by `npm run setup:storage`). */
export async function ensureJobPhotosBucket(): Promise<"created" | "exists"> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.storage.getBucket(JOB_PHOTOS_BUCKET);
  if (data) return "exists";
  const { error } = await supabase.storage.createBucket(JOB_PHOTOS_BUCKET, {
    public: true,
    fileSizeLimit: MAX_PHOTO_BYTES,
    allowedMimeTypes: Object.keys(ALLOWED_CONTENT_TYPES),
  });
  if (error) throw new Error(`Could not create bucket "${JOB_PHOTOS_BUCKET}": ${error.message}`);
  return "created";
}
