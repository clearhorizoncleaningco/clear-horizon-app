import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Data Access Layer (per Next.js auth guidance): centralize the session +
 * authorization checks. `cache()` dedupes these within a single render pass.
 */

export type ProfileWithOrg = Prisma.ProfileGetPayload<{
  include: { organization: true };
}>;

/** The verified Supabase user for this request, or null. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** The current user paired with their org-scoped Profile (role + organization). */
export const getCurrentProfile = cache(
  async (): Promise<{ user: User; profile: ProfileWithOrg | null } | null> => {
    const user = await getCurrentUser();
    if (!user) return null;

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      include: { organization: true },
    });

    return { user, profile };
  },
);

/**
 * Require an authenticated user. Redirects to /login when there is no session.
 * A logged-in user without a Profile row is returned with `profile: null` (the
 * caller renders a "not provisioned" state) — we do NOT redirect in that case,
 * to avoid a loop with the proxy (which would bounce an authed user back).
 */
export async function requireProfile() {
  const result = await getCurrentProfile();
  if (!result) redirect("/login");
  return result;
}

/** True when the current user is an Admin (full pricing + margin visibility). */
export async function isAdmin(): Promise<boolean> {
  const result = await getCurrentProfile();
  return result?.profile?.role === "Admin";
}
