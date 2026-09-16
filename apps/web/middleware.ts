import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that require authentication
const protectedRoutes = ["/chat", "/social", "/contacts", "/profile", "/admin"];

// Routes for unauthenticated users only
const authRoutes = ["/login", "/register"];

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const token = request.cookies.get("auth_token");
  const userRole = request.cookies.get("user_role");

  // Get auth token from cookie or localStorage (client-side fallback)
  const hasAuth = !!token;

  // Protected routes - require authentication
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (isProtectedRoute && !hasAuth) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Admin routes - require admin role
  if (pathname.startsWith("/admin") && userRole?.value !== "admin") {
    return NextResponse.redirect(new URL("/chat", request.url));
  }

  // Auth routes - redirect to dashboard if already logged in
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  if (isAuthRoute && hasAuth) {
    return NextResponse.redirect(new URL("/chat", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public folder)
     */
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
