import { NextRequest, NextResponse } from "next/server";

/** Validates the Authorization: Basic ... header against env-var credentials. */
function isAuthorized(req: NextRequest): boolean {
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Basic ")) return false;

  let decoded: string;
  try {
    decoded = atob(header.slice(6));
  } catch {
    return false;
  }

  const user = process.env.ADMIN_USER ?? "";
  const pass = process.env.ADMIN_PASSWORD ?? "";

  // Require both env vars to be set; empty credentials never match.
  if (!user || !pass) return false;

  return decoded === `${user}:${pass}`;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isAdminPage = pathname.startsWith("/admin");
  const isAdminApi  = pathname.startsWith("/api/admin");

  if (isAdminPage || isAdminApi) {
    // Allow unrestricted local development access
    if (process.env.VERCEL_ENV !== "production") {
      return NextResponse.next();
    }

    if (!isAuthorized(req)) {
      // API routes get a JSON 401 so callers can handle it programmatically
      if (isAdminApi) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Browser routes get the standard Basic Auth challenge
      return new NextResponse("Access denied. Authentication required.", {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Basic realm="WOOF Admin", charset="UTF-8"',
          // Keep admin routes out of search engine indexes
          "X-Robots-Tag": "noindex, nofollow",
        },
      });
    }

    // Authenticated — add noindex header and continue
    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
