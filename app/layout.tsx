import type { Metadata } from "next";
import "./globals.css";
import { applyDueClientReminders, applyDueProgramDeployments } from "./lib/queries";

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

  // Colours are fixed to the design's palette (see the tokens at the top of
  // globals.css) rather than injected per coach. Coach-configurable branding
  // is deliberately out for now: one moving accent was enough to make both
  // apps drift away from the files they were drawn from.
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
