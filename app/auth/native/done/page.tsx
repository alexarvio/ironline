"use client";

import { useEffect } from "react";

// Back from Google in the app's secure sheet. Clerk arrives here by a client-side push, so this page makes the one
// real page load of /auth/native/finish (review of 2e029fe: a push fetched finish's redirect in the background first),
// the start's secret number passed on.
export default function NativeDonePage() {
  useEffect(() => {
    const n = new URLSearchParams(window.location.search).get("n") ?? "";
    window.location.replace(`/auth/native/finish?n=${encodeURIComponent(n)}`);
  }, []);
  return null;
}
