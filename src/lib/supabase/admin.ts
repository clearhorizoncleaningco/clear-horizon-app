import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

/**
 * Supabase ADMIN client (service-role key) for server-side Storage operations
 * (uploading job before/after photos in Phase 3). The service-role key is a
 * server-only secret — intentionally NOT in src/lib/env.ts (which is public) and
 * never imported from a client bundle (this file is `server-only`).
 *
 * Read lazily at call time so the app/tests boot without it; only the photo
 * upload path requires it, and it fails clearly when missing.
 */
let cached: SupabaseClient | null = null;

export function isStorageConfigured(): boolean {
  return Boolean((process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim());
}

export function getSupabaseAdmin(): SupabaseClient {
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — required to upload job photos. Add it to your environment (see README §2).",
    );
  }
  if (!cached) {
    cached = createClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return cached;
}
