import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// This cookie is only a routing hint. API authorization still relies on the access token.
const SESSION_HINT_COOKIE = "g000st_session_hint";

const protectedRoutes = [
  "/chat",
  "/social",
  "/social-chat",
  "/contacts",
  "/profile",
  "/mobile",
];
const adminRoutes = ["/dashboard", "/users", "/settings", "/billing"];

// Routes for unauthenticated users only
const authRoutes = ["/login", "/register"];

function redirectTo(request: NextRequest, pathname: string) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const protocol =
    forwardedProto || request.nextUrl.protocol.replace(":", "") || "https";

  if (host)
    return NextResponse.redirect(new URL(pathname, `${protocol}://${host}`));
  return NextResponse.redirect(new URL(pathname, request.url));
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const sessionHint = request.cookies.get(SESSION_HINT_COOKIE);
  const userRole = request.cookies.get("user_role");
  const hasAuth = sessionHint?.value === "1";

  if (pathname === "/") {
    return redirectTo(request, hasAuth ? "/social" : "/login");
  }

  // Protected routes - require authentication
  const isProtectedRoute = [...protectedRoutes, ...adminRoutes].some((route) =>
    pathname.startsWith(route),
  );

  if (isProtectedRoute && !hasAuth) {
    return redirectTo(request, "/login");
  }

  // Admin routes - require admin role
  if (
    adminRoutes.some((route) => pathname.startsWith(route)) &&
    userRole?.value !== "admin"
  ) {
    return redirectTo(request, "/chat");
  }

  // Auth routes - redirect to dashboard if already logged in
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  if (isAuthRoute && hasAuth) {
    return redirectTo(request, "/chat");
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
