import type { Metadata, Viewport } from "next";
import "./globals.css";
import { applyDueClientReminders, applyDueProgramDeployments, getBranding } from "./lib/queries";
import { brandCssVars } from "./lib/branding";

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

  // One brand colour, chosen on the Branding page, overrides the accent
  // tokens for every route; the contrast-safe companions (text on the fill,
  // the accent as text, the pale tint) are derived, never chosen. With no
  // colour set nothing is injected and the design's own tokens apply.
  const branding = getBranding();
  const overrides = branding.color_primary ? brandCssVars(branding.color_primary) : "";
  return (
    <html lang="en">
      <body>
        {overrides && <style>{`:root { ${overrides} }`}</style>}
        {children}
      </body>
    </html>
  );
}
