import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

/** Decode JWT payload without verifying signature (signature is verified by the backend).
 *  Used here only for UX: redirect expired tokens to login early rather than letting
 *  the user load the dashboard and get a 401 on the first API call. */
function isTokenExpired(token: string): boolean {
  try {
    const [, payloadB64] = token.split(".");
    if (!payloadB64) return true;
    const json = Buffer.from(payloadB64, "base64url").toString("utf8");
    const { exp } = JSON.parse(json) as { exp?: number };
    if (!exp) return false; // no exp claim → treat as non-expiring (backend enforces)
    return Date.now() / 1000 > exp;
  } catch {
    return true; // malformed token → treat as expired
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // API routes are handled by /app/api/[...path]/route.ts — skip middleware
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const rawToken = request.cookies.get("token")?.value;
  // Token is valid for routing purposes only if it exists and is not expired
  const token = rawToken && !isTokenExpired(rawToken) ? rawToken : null;

  // Landing page — always public; logged-in users go straight to dashboard
  if (pathname === "/") {
    if (token) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // Unauthenticated (or expired token) hitting a protected route → login
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
