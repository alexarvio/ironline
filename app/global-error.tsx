"use client";

import * as Sentry from "@sentry/nextjs";
import localFont from "next/font/local";
import { useEffect } from "react";
import { NorCoachMark } from "./components/NorCoachLogo";

// The last-resort boundary: an error that took down the whole page, root
// layout included. It is reported to Sentry, and the person gets a way to
// try again instead of a blank screen. Styled inline, since globals.css comes
// from the layout that just failed. In the app's own look (26 Oct, Alex: it was
// still the old navy button): the page colour, the star, Archivo, an ink title,
// one quiet line and the ink pill.
const archivo = localFont({ src: "./fonts/Archivo-Latin.woff2", weight: "400 800", display: "swap" });

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className={archivo.className} style={{ margin: 0, minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F5F6F8", color: "#141a24" }}>
        <main style={{ maxWidth: 320, padding: "24px 16px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <NorCoachMark className="ge-mark" />
          <style>{`.ge-mark { width: 34px; height: 34px; margin-bottom: 20px; color: #141a24; }`}</style>
          <h1 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em" }}>Something went wrong</h1>
          <p style={{ margin: "0 0 22px", fontSize: 13.5, fontWeight: 500, lineHeight: 1.5, color: "#8b93a1" }}>We have been told about it.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ height: 42, padding: "0 22px", border: 0, borderRadius: 999, background: "#141a24", color: "#fff", font: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
