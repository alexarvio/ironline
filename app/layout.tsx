import type { Metadata } from "next";
import "./globals.css";
import { applyDueClientReminders, applyDueProgramDeployments, getBranding } from "./lib/queries";
import {
  DEFAULT_BRAND_PRIMARY,
  DEFAULT_CLIENT_ACCENT,
  pickAccentOnDark,
  pickForegroundColor,
  pickTextSafeColor,
} from "./lib/branding";

export const metadata: Metadata = {
  title: "Ironline",
  description: "Coach + client core loop prototype",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // No background job runner in this app — a plan the coach scheduled for
  // e.g. Monday 6am goes live the moment anyone next loads any page after
  // that time, checked here since every route passes through this layout.
  applyDueProgramDeployments();
  applyDueClientReminders();

  const branding = getBranding();
  const primary = branding.color_primary ?? DEFAULT_BRAND_PRIMARY;
  // Coach-chosen brand colors, applied as a root-level override of the CSS
  // custom properties they're allowed to touch — --accent (fills: buttons,
  // avatars, active pills), --accent-fg (text/icons ON TOP of an --accent
  // fill, picked for contrast so a light accent like lime doesn't get
  // unreadable white text), --accent-ink (the accent used AS text/icon/
  // border color against the app's light surfaces — links, chart lines,
  // badge text — darkened only as much as needed to stay legible), and the
  // phone-frame bezel color behind the client app mockup. Injected here
  // rather than per-page so every route (/, /admin, /client) picks it up
  // from one place.
  //
  // The client app (/client) is a single dark theme whose surfaces are fixed;
  // only the accent follows the coach's brand — --fp-accent (every highlight,
  // fill, bar, chart line and active state on those screens) and
  // --fp-accent-fg (text/icons ON TOP of an --fp-accent fill). The accent is
  // lightened only as much as needed to stay readable on that dark surface,
  // so a dark brand color can't disappear into the background.
  const clientAccent = pickAccentOnDark(branding.color_primary ?? DEFAULT_CLIENT_ACCENT);
  const colorOverrides = [
    `--accent: ${primary};`,
    `--accent-fg: ${pickForegroundColor(primary)};`,
    `--accent-ink: ${pickTextSafeColor(primary)};`,
    `--fp-accent: ${clientAccent};`,
    `--fp-accent-fg: ${pickForegroundColor(clientAccent)};`,
    branding.color_frame ? `--brand-frame: ${branding.color_frame};` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <html lang="en">
      <body>
        {colorOverrides && <style>{`:root { ${colorOverrides} }`}</style>}
        {children}
      </body>
    </html>
  );
}
