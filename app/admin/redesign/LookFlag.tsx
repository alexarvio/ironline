"use client";

import { useEffect } from "react";

// A preview switch for the admin in the client app's design language
// (17 Oct, Alex): ?look=hairline puts `look-hl` on <html>, and
// look-hairline.css restyles the admin under it. Without the parameter
// nothing changes. Local only, to look at; not a setting.
export default function LookFlag() {
  useEffect(() => {
    const on = new URLSearchParams(window.location.search).get("look") === "hairline";
    document.documentElement.classList.toggle("look-hl", on);
  }, []);
  return null;
}
