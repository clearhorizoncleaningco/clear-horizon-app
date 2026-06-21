/**
 * One-time setup for job photo storage (BUILD_SPEC §G Phase 3).
 *
 * Idempotently creates the PUBLIC `job-photos` Supabase Storage bucket that the
 * Cleaner view uploads before/after photos to and the customer report reads from.
 * Run with `npm run setup:storage` after filling in Supabase env. Safe to re-run.
 *
 * Standalone (no `@/` alias / `server-only`) so it runs under tsx.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "job-photos";
const MAX_BYTES = 12 * 1024 * 1024;
const MIME = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic"];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.startsWith("placeholder")) {
    throw new Error(`Missing/placeholder env var: ${name}. Fill in real Supabase values in .env.`);
  }
  return value;
}

async function main() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: existing } = await supabase.storage.getBucket(BUCKET);
  if (existing) {
    console.log(`✔ Bucket "${BUCKET}" already exists (public: ${existing.public}).`);
    return;
  }

  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: MIME,
  });
  if (error) throw new Error(`Could not create bucket "${BUCKET}": ${error.message}`);
  console.log(`✔ Created public bucket "${BUCKET}" (max ${MAX_BYTES / 1024 / 1024} MB).`);
}

main().catch((err) => {
  console.error("\n✖ Storage setup failed:");
  console.error(err);
  process.exit(1);
});
