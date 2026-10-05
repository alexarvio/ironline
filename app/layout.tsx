import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { applyDueClientReminders, applyDueProgramDeployments } from "./lib/queries";
import { ClerkProvider } from "@clerk/nextjs";
import { clerkOn } from "./lib/clerk";

export const metadata: Metadata = {
  title: "Ironline",
  description: "Coach + client core loop prototype",
  // "Add to Home Screen" support: the manifest (app/manifest.ts) carries the
  // name, icons and standalone display for Android/Chrome; iOS ignores most
  // of the manifest and reads these apple-specific tags instead.
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Ironline",
    statusBarStyle: "default",
  },
};

// The client Nutrition tab's serif is Baskerville, built into iPhones. This
// self-hosted Libre Baskerville stands in wherever it is missing; the tab's
// CSS names it through this variable.
// The three Google fonts live in app/fonts (5 Oct): the build used to fetch
// them from Google, and when Railway's builder could not reach Google the
// whole build failed. Latin only, as before; Archivo and Libre Baskerville
// are variable files that hold every weight.
const libreBaskerville = localFont({
  src: [
    { path: "./fonts/LibreBaskerville-Latin.woff2", weight: "400 700", style: "normal" },
    { path: "./fonts/LibreBaskerville-Italic-Latin.woff2", weight: "400 700", style: "italic" },
  ],
  variable: "--font-libre-baskerville",
  display: "swap",
});
// Archivo: the client Nutrition tab's type. Regular text, Medium figures,
// SemiBold headings and names.
const archivo = localFont({
  src: "./fonts/Archivo-Latin.woff2",
  weight: "400 800",
  variable: "--font-archivo",
  display: "swap",
});
// Bricolage Grotesque: only the date number on Home's meeting card.
const bricolage = localFont({
  src: "./fonts/BricolageGrotesque-800-Latin.woff2",
  weight: "800",
  variable: "--font-bricolage",
  display: "swap",
});
// Kirana: the "Ironline" wordmark at the top left of the client app.
const kirana = localFont({
  src: "./fonts/Kirana-Regular.ttf",
  variable: "--font-brand",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#2f5d8f",
  width: "device-width",
  initialScale: 1,
  // The client app is a phone UI with its own type sizes; pinch-zoom stays
  // enabled (maximumScale unset) for accessibility.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // No background job runner in this app — a plan the coach scheduled for
  // e.g. Monday 6am goes live the moment anyone next loads any page after
  // that time, checked here since every route passes through this layout.
  applyDueProgramDeployments();
  applyDueClientReminders();

  // Colours are fixed to the design's palette (see the tokens at the top of
  // globals.css) rather than injected per coach. Coach-configurable branding
  // is deliberately out for now: one moving accent was enough to make both
  // apps drift away from the files they were drawn from.
  return (
    <html lang="en" className={`${libreBaskerville.variable} ${archivo.variable} ${kirana.variable} ${bricolage.variable}`}>
      {/* Sign-in through Clerk, when it is switched on (lib/clerk.ts). */}
      <body>{clerkOn() ? <ClerkProvider signInUrl="/login" signUpUrl="/signup" signInFallbackRedirectUrl="/auth/continue" signUpFallbackRedirectUrl="/auth/continue" afterSignOutUrl="/login">{children}</ClerkProvider> : children}</body>
    </html>
  );
}
