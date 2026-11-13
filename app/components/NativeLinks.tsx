"use client";

import { useEffect } from "react";
import { callNative, nativeApp, onNative } from "../lib/native";

// A link tapped outside the app that the app is allowed to open (13 Nov, Alex: the coach's invite; the paths are in
// app/.well-known/apple-app-site-association): iOS opens the app and hands it the address, and this takes the app's
// page there. A cold start reads it from getLaunchUrl, an app already open hears appUrlOpen. Only our own address,
// never anywhere else.

const OURS = "app.norcoachapp.com";

function go(raw: string | undefined) {
  if (!raw) return;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return;
  }
  if (url.protocol !== "https:" || url.hostname !== OURS) return;
  const here = window.location;
  if (here.pathname + here.search === url.pathname + url.search) return;
  here.assign(url.pathname + url.search + url.hash);
}

export default function NativeLinks() {
  useEffect(() => {
    if (!nativeApp()) return;
    onNative<{ url?: string }>("App", "appUrlOpen", (e) => go(e?.url));
    // Opened by the link itself: once per launch, so coming back to a page later never sends it there again.
    const KEY = "norcoach.launch-url-seen";
    let seen = false;
    try {
      seen = sessionStorage.getItem(KEY) === "1";
      sessionStorage.setItem(KEY, "1");
    } catch {}
    if (!seen) {
      callNative<{ url?: string }>("App", "getLaunchUrl")
        .then((r) => go(r?.url))
        .catch(() => {});
    }
  }, []);
  return null;
}
