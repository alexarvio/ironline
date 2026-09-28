import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";

// Next 16 renamed `middleware.ts` to `proxy.ts` — same mechanism, new name.
//
// This is an OPTIMISTIC check only: it looks for the presence of a session
// cookie and nothing more. It does not verify the signature and it does not
// know the user's role, because proxy runs on every request (including
// prefetches) and must not touch the data layer.
//
// Real enforcement lives in requireCoach() / requireClient() in lib/auth.ts,
// called by every protected page and every server action. If this file were
// deleted the app would still be secure — it would just show a flash of a
// protected route before redirecting. Never move an authorization decision
// up here.

// The privacy policy and support page are public: the App Store links to them.
// /signup, /invite, /sso-callback and /auth/* are Clerk's way in (26 Sep).
// /api/dev: local-only tools that refuse to run on a server (and are never deployed).
const PUBLIC_PATHS = ["/login", "/privacy", "/support", "/signup", "/invite", "/sso-callback", "/auth", "/api/dev"];

// With sign-in through Clerk (lib/clerk.ts: AUTH_PROVIDER=clerk), Clerk's
// middleware runs instead: it reads the session so auth() works on the
// server, and sends a signed-out visitor to /login. Our guards still decide
// everything else, as before.
const clerkOn = process.env.AUTH_PROVIDER === "clerk" && !!process.env.CLERK_SECRET_KEY && !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const isPublic = (pathname: string) => PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
// Built only when on, so the live app without Clerk keys never loads it.
// Our own sign-in and sign-up pages, never Clerk's hosted ones.
const withClerk = !clerkOn ? null : clerkMiddleware(async (auth, request) => {
  if (isPublic(request.nextUrl.pathname)) return;
  const { userId } = await auth();
  if (userId) return;
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}, { signInUrl: "/login", signUpUrl: "/signup" });

export function proxy(request: NextRequest, event: NextFetchEvent) {
  if (withClerk) return withClerk(request, event);
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  const hasSession = request.cookies.has("ironline_session");
  if (hasSession) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except Next's own assets, the uploads route, Stripe's webhook
  // (signed, no cookie) and the coach's
  // video-reply upload (which do their own per-request authorization; the
  // proxy would also buffer and cut off a big upload body), and common static files. The app icons
  // (app/icon.png, app/apple-icon.png) and the logo under public/brand must
  // stay public too: the phone fetches them from the manifest with no cookie
  // when the client adds the app to their home screen, and the login page
  // shows the logo before anyone has a session. sw.js too: the browser
  // re-checks the service worker on its own, cookie or not, and a redirect
  // to /login there would break push notifications once a session expired.
  matcher: ["/((?!_next/static|_next/image|uploads|api/video-reply|api/stripe/webhook|favicon.ico|manifest.webmanifest|icon.png|apple-icon.png|sw.js|icons/|brand/).*)"],
};
