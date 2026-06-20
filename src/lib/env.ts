import { z } from "zod";

/**
 * Public environment (NEXT_PUBLIC_*). These are inlined into the client bundle
 * at build time, so they must be referenced statically (not via a dynamic key).
 * Validated once with Zod per CLAUDE.md §3.6 (Zod at every boundary).
 *
 * Server-only secrets (SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL) are intentionally
 * NOT included here so this module is safe to import from client components.
 * Those are read + guarded at their point of use (src/lib/db.ts, prisma/seed.ts).
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  NEXT_PUBLIC_SITE_URL: z.url(),
});

export const publicEnv = publicEnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});
