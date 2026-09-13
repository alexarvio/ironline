"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// The last-resort boundary: an error that took down the whole page, root
// layout included. It is reported to Sentry, and the person gets a way to
// try again instead of a blank screen. Styled inline, since globals.css comes
// from the layout that just failed.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f6f8", fontFamily: "system-ui, sans-serif", color: "#141a24" }}>
        <main style={{ maxWidth: 360, padding: 24, textAlign: "center" }}>
          <h1 style={{ margin: "0 0 8px", fontSize: 20 }}>Something went wrong</h1>
          <p style={{ margin: "0 0 20px", fontSize: 14, lineHeight: 1.5, color: "#5b6474" }}>
            It has been reported. Try again, or close and reopen the app.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ minHeight: 44, padding: "0 20px", border: 0, borderRadius: 10, background: "#1e3a6e", color: "#fff", font: "inherit", fontSize: 14, fontWeight: 800, cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
