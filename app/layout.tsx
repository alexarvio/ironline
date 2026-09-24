import type { Metadata, Viewport } from "next";
import { Archivo, Bricolage_Grotesque, Libre_Baskerville } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { applyDueClientReminders, applyDueProgramDeployments } from "./lib/queries";

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
const libreBaskerville = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-libre-baskerville",
  display: "swap",
});
// Archivo: the client Nutrition tab's type. Regular text, Medium figures,
// SemiBold headings and names.
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-archivo",
  display: "swap",
});
// Bricolage Grotesque: only the date number on Home's meeting card.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["800"],
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
      <body>{children}</body>
    </html>
  );
}
