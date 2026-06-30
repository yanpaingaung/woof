import { NextRequest, NextResponse } from "next/server";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Block /admin page and /api/admin/* on production Vercel deployments
  if (process.env.VERCEL_ENV === "production") {
    if (pathname.startsWith("/admin")) {
      return NextResponse.rewrite(new URL("/404", req.url));
    }
    if (pathname.startsWith("/api/admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
