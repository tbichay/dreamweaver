import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = [
  "/",
  "/sign-in",
  "/sign-up",
  "/impressum",
  "/agb",
  "/datenschutz",
  "/barrierefreiheit",
  "/api/audio/onboarding",
  "/api/audio/help",   // Help-Audio Clips (public)
  "/api/audio",        // Audio-Proxy auch für Share-Links ohne Login
  "/api/images",
  "/api/icons",
  "/api/auth",
  "/api/account/check-email",
  "/api/avatars",
  "/api/cron",         // Vercel Cron Jobs (auth via CRON_SECRET header)
  "/api/canzoia",      // Canzoia API (auth via HMAC, see lib/canzoia/signing.ts)
  "/api/health",       // Ops health endpoints (auth via CRON_SECRET header in handler)
  "/api/invite",       // Invitation acceptance (public, auth checked in handler)
  "/api/admin/onboarding", // Onboarding status check
  "/api/generate-scene-clip", // SSE streaming — auth checked in handler
  "/api/admin/render-film",   // SSE streaming — auth checked in handler
  "/api/admin/generate-storyboard", // Long-running — auth checked in handler
  "/api/studio/projects",     // Studio V2 — SSE streaming, auth checked in handlers
  "/engine",           // Engine landing page (public on koalatree.io)
  "/share",
  "/einladung",        // Invitation acceptance page
];

function isPublic(pathname: string): boolean {
  return publicPaths.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

// Alte Clerk-Cookies aufräumen
const STALE_PREFIXES = ["__clerk", "__client_uat", "clerk_"];

function cleanResponse(request: NextRequest, response: NextResponse): NextResponse {
  for (const cookie of request.cookies.getAll()) {
    if (STALE_PREFIXES.some((p) => cookie.name.startsWith(p)) ||
        cookie.name === "__session" || cookie.name.startsWith("__session_")) {
      response.cookies.set(cookie.name, "", { maxAge: 0, path: "/" });
    }
  }
  return response;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const host = request.headers.get("host") || "";
  const isEngine = host.includes("koalatree.io");
  const isDev = host.includes("localhost") || host.includes("127.0.0.1");

  // ── Domain Routing: koalatree.io → Engine only ──
  if (isEngine && !isDev) {
    const isStudioRoute = pathname.startsWith("/studio") || pathname.startsWith("/api/studio");
    const isAuthRoute = pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up") || pathname.startsWith("/api/auth");
    const isStaticAsset = pathname.startsWith("/api/images") || pathname.startsWith("/api/icons") || pathname.startsWith("/api/audio");
    const isEngineLanding = pathname === "/" || pathname === "/engine";

    // Root + /engine → Public landing page (no auth needed)
    if (isEngineLanding) {
      // Rewrite to /engine page (public, no redirect loop)
      const url = request.nextUrl.clone();
      url.pathname = "/engine";
      return cleanResponse(request, NextResponse.rewrite(url));
    }

    // Block Kids App routes on Engine domain
    if (!isStudioRoute && !isAuthRoute && !isStaticAsset && !isPublic(pathname)) {
      return cleanResponse(request, NextResponse.redirect(new URL("/engine", request.url)));
    }
  }

  // ── Inject domain context as header for layouts ──
  const response = NextResponse.next();
  if (isEngine) response.headers.set("x-koalatree-domain", "engine");

  if (isPublic(pathname)) {
    return cleanResponse(request, response);
  }

  // Session-Cookie prüfen — Auth.js nutzt __Secure- Prefix auf HTTPS
  const hasSession =
    request.cookies.has("__Secure-authjs.session-token") ||
    request.cookies.has("authjs.session-token");

  if (!hasSession) {
    // API routes: return JSON 401 instead of redirect (prevents JSON parse errors in frontend)
    if (pathname.startsWith("/api/")) {
      return cleanResponse(request, NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 }));
    }
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return cleanResponse(request, NextResponse.redirect(signInUrl));
  }

  return cleanResponse(request, response);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js|json|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
