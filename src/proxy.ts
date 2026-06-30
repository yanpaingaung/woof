import { NextRequest, NextResponse } from "next/server";

export function proxy(req: NextRequest) {
  // Block /admin on production Vercel deployments
  if (
    process.env.VERCEL_ENV === "production" &&
    req.nextUrl.pathname.startsWith("/admin")
  ) {
    return NextResponse.rewrite(new URL("/404", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/admin/:path*",
};
