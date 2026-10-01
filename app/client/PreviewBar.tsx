"use client";

import { useEffect } from "react";

// A coach looking at the client app sees whose it is, and can switch (1 Oct).
// Without it the app silently showed the first client by name, and a new
// client sorting first made it look like someone else's app had replaced
// your own. The pick is remembered (a cookie the page reads), so opening the
// app again lands on the same client.

export const PREVIEW_COOKIE = "ironline_preview";

export default function PreviewBar({ current, clients }: { current: { id: number; name: string }; clients: { id: number; name: string }[] }) {
  // Arriving with ?client= (the admin's View client app) counts as a pick too.
  useEffect(() => {
    document.cookie = `${PREVIEW_COOKIE}=${current.id}; path=/; max-age=31536000; samesite=lax`;
  }, [current.id]);
  const first = current.name.trim().split(/\s+/)[0] || "this client";
  return (
    <div className="preview-bar" role="region" aria-label="Client app preview">
      <span className="preview-bar-dot" aria-hidden="true" />
      <span className="preview-bar-text">
        Previewing <b>{first}&rsquo;s</b> app
      </span>
      <label className="preview-bar-switch">
        <span>Switch client</span>
        <select
          value={current.id}
          onChange={(e) => {
            const id = Number(e.target.value);
            document.cookie = `${PREVIEW_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
            // A full load, not router.push: nothing open in the last client's
            // app (a pushed screen, a typed check-in) may carry into this one's.
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            window.location.href = `/client?client=${id}`;
          }}
          aria-label="Switch client"
        >
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
