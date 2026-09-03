import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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

const PUBLIC_PATHS = ["/login"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isPublic) return NextResponse.next();

  const hasSession = request.cookies.has("ironline_session");
  if (hasSession) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except Next's own assets, the uploads route (which does its
  // own per-request authorization), and common static files. The app icons
  // (app/icon.png, app/apple-icon.png) and the logo under public/brand must
  // stay public too: the phone fetches them from the manifest with no cookie
  // when the client adds the app to their home screen, and the login page
  // shows the logo before anyone has a session.
  matcher: ["/((?!_next/static|_next/image|uploads|favicon.ico|manifest.webmanifest|icon.png|apple-icon.png|icons/|brand/).*)"],
};
