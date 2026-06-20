import { requireProfile } from "@/lib/auth/dal";
import { AppHeader } from "@/components/app-header";

/**
 * Layout for all authenticated app routes. Enforces a session (redirect to
 * /login when absent) and renders the branded header. Pages inside still
 * re-verify via the DAL — this layout check is defense-in-depth, not the only
 * gate (Next.js partial-rendering caveat).
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await requireProfile();

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader email={profile?.email ?? user.email} role={profile?.role} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
