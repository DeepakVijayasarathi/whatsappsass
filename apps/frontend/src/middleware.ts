import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── API proxy — rewrite /api/* to backend at runtime ──────────────────────
  if (pathname.startsWith("/api/")) {
    const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:4000";
    const upstream = pathname.replace(/^\/api/, "");
    const search = request.nextUrl.search;
    const target = `${backendUrl}${upstream}${search}`;
    return NextResponse.rewrite(target);
  }

  const token = request.cookies.get("token")?.value;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // Unauthenticated user hitting a protected route → login
  if (!token && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  // Authenticated user hitting login/register → dashboard
  if (token && isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
