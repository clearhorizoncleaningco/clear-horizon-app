import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";

/**
 * Next 16 Proxy (formerly `middleware.ts`). Runs on the Node.js runtime.
 *
 * Responsibilities:
 *  1. Refresh the Supabase session cookie on every request (getUser()).
 *  2. Optimistic route protection: send unauthenticated users to /login and
 *     authenticated users away from /login.
 *
 * This is a first line of defense only — Server Components and Route Handlers
 * re-verify via the DAL (src/lib/auth/dal.ts).
 */

// `/approve` is the public, token-gated customer e-approval page (no login).
const PUBLIC_PATHS = ["/login", "/auth/callback", "/auth/signout", "/approve"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Do not run other logic between creating the client and getUser() — see
  // Supabase SSR guidance. getUser() revalidates the token and refreshes cookies.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Unauthenticated user hitting a protected route -> /login (remember target).
  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return redirectPreservingCookies(url, response);
  }

  // Authenticated user hitting /login -> /dashboard.
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return redirectPreservingCookies(url, response);
  }

  return response;
}

/** Build a redirect that carries over any refreshed Supabase auth cookies. */
function redirectPreservingCookies(url: URL, source: NextResponse) {
  const redirectResponse = NextResponse.redirect(url);
  for (const cookie of source.cookies.getAll()) {
    redirectResponse.cookies.set(cookie);
  }
  return redirectResponse;
}

export const config = {
  // Run on everything except API routes, Next internals, and static assets
  // (including the brand PNG logos served from /public).
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon.png|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)",
  ],
};
