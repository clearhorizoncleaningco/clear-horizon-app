import Image from "next/image";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import logo from "../../public/brand/03_alt_horizontal_2.png";
import type { Role } from "@/generated/prisma/client";

const ROLE_LABELS: Record<Role, string> = {
  Admin: "Admin",
  OfficeStaff: "Office Staff",
  Cleaner: "Cleaner",
};

/** Role-aware nav: cleaners get a focused view; staff/admins get the full set. */
function navLinks(role?: Role | null): { href: string; label: string }[] {
  if (role === "Cleaner") {
    return [
      { href: "/cleaner", label: "My jobs" },
      { href: "/cleaner/earnings", label: "Earnings" },
    ];
  }
  const links = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/estimate/new", label: "New estimate" },
    { href: "/estimates", label: "Estimates" },
    { href: "/customers", label: "Customers" },
    { href: "/jobs", label: "Jobs" },
    { href: "/reports", label: "Reports" },
  ];
  if (role === "Admin") {
    links.push({ href: "/calibration", label: "Calibration" });
    links.push({ href: "/admin/pricing", label: "Pricing" });
  }
  return links;
}

export function AppHeader({
  email,
  role,
}: {
  email?: string | null;
  role?: Role | null;
}) {
  const links = navLinks(role);
  const home = role === "Cleaner" ? "/cleaner" : "/dashboard";
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-2">
          <Link href={home} className="flex items-center" aria-label="Clear Horizon — Home">
            {/* Brand horizontal logo (wired by filename per BUILD_SPEC §C). */}
            <Image src={logo} alt="Clear Horizon Cleaning Co." className="h-9 w-auto" priority />
          </Link>
          <nav className="ml-2 hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {role ? (
            <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
              {ROLE_LABELS[role]}
            </span>
          ) : null}
          {email ? (
            <span className="hidden text-sm text-muted-foreground sm:inline">{email}</span>
          ) : null}
          <ThemeToggle />
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
