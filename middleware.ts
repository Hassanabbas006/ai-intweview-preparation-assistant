import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { ADMIN_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/auth/admin-session";

// Candidate protected routes
const CANDIDATE_PROTECTED_PATHS = [
  "/dashboard",
  "/interview",
  "/resume",
  "/coding-arena",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // -------------------------------------------------------------
  // 1. ADMIN ROUTE ISOLATION & PROTECTION
  // -------------------------------------------------------------
  if (pathname.startsWith("/admin")) {
    const adminToken = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
    const isValidAdmin = adminToken ? await verifyAdminSessionToken(adminToken) : null;

    // Admin login page
    if (pathname === "/admin/login") {
      if (isValidAdmin) {
        return NextResponse.redirect(new URL("/admin/dashboard", request.url));
      }
      return NextResponse.next();
    }

    // All other /admin/* routes require valid admin session
    if (!isValidAdmin) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }

    return NextResponse.next();
  }

  // -------------------------------------------------------------
  // 2. CANDIDATE AUTHENTICATION & ROUTE PROTECTION
  // -------------------------------------------------------------
  const candidateToken = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // Candidate login/signup pages: redirect to /dashboard if already authenticated
  if (pathname === "/login" || pathname === "/signup") {
    if (candidateToken) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // Candidate protected routes
  const isCandidateProtected = CANDIDATE_PROTECTED_PATHS.some((path) =>
    pathname.startsWith(path)
  );

  if (isCandidateProtected && !candidateToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api routes (handled individually or by NextAuth)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
