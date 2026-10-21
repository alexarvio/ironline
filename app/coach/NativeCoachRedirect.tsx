"use client";

import { useEffect } from "react";
import { nativeApp } from "../lib/native";

// One app, a coach mode (21 Oct, Alex): the native app opens the site at
// /client, and sign-in sends a coach to the admin; inside the app a coach
// belongs on their phone screens (/coach) instead. Mounted where a coach can
// land: the client app (a coach's preview of it) and every admin screen.
// Never inside a frame (the admin's phone preview) and never in a browser.
export default function NativeCoachRedirect() {
  useEffect(() => {
    if (nativeApp() && window.top === window.self) window.location.replace("/coach");
  }, []);
  return null;
}
