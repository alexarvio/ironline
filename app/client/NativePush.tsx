"use client";

import { useEffect } from "react";
import { callNative, nativePlatform, onNative, type NativePlatform } from "../lib/native";

// Notifications in the phone apps: the @capacitor/push-notifications plugin
// gives the phone a token (Firebase's on Android, Apple's APNs one on an
// iPhone, 12 Nov), /api/push keeps it (kind "fcm" or "apns") and lib/fcm.ts
// or lib/apns.ts sends to it. The switch is PushToggle; this file holds the
// plugin calls and, mounted once in the app, opens what a tapped
// notification points at.

type Permission = "granted" | "denied" | "prompt" | "prompt-with-rationale";

export const NATIVE_PUSH = {
  checkPermissions: async () => (await callNative<{ receive: Permission }>("PushNotifications", "checkPermissions")).receive,
  requestPermissions: async () => (await callNative<{ receive: Permission }>("PushNotifications", "requestPermissions")).receive,
};

/** What /api/push is posted for this phone's token. */
export const tokenBody = (platform: NativePlatform, token: string) => (platform === "ios" ? { apns: token } : { fcm: token });

// The token this phone last gave the server, kept on the phone so the switch
// knows what to ask /api/push about. (The key's name is from when only
// Android had one.)
const KEY = "ironline-fcm-token";
export const readPushToken = () => {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
};
export const rememberPushToken = (token: string) => {
  try {
    window.localStorage.setItem(KEY, token);
  } catch {
    /* blocked storage: the switch reads as off next visit */
  }
};

/** Registers with the phone's push service and resolves with this phone's token. */
export async function pushTokenFromPhone(platform: NativePlatform): Promise<string> {
  // Android files notifications under a channel the person can mute in
  // Settings; the server sends to this one (lib/fcm.ts). An iPhone has none.
  if (platform === "android") await callNative("PushNotifications", "createChannel", { id: "ironline", name: "Coach updates", importance: 4 }).catch(() => {});
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("No token from the phone")), 20_000);
    onNative<{ value: string }>("PushNotifications", "registration", (t) => {
      clearTimeout(timer);
      resolve(t.value);
    });
    onNative<{ error: string }>("PushNotifications", "registrationError", (e) => {
      clearTimeout(timer);
      reject(new Error(e.error));
    });
    callNative("PushNotifications", "register").catch(reject);
  });
}

export async function forgetPushToken(platform: NativePlatform) {
  try {
    window.localStorage.removeItem(KEY);
  } catch {}
  // An iPhone keeps its registration: Apple advises against unregistering, and the server no longer has the token, so
  // nothing reaches the phone; turned on again, it gives the same token at once.
  if (platform === "android") await callNative("PushNotifications", "unregister").catch(() => {});
}

export function NativePush() {
  useEffect(() => {
    const platform = nativePlatform();
    if (!platform) return;
    // Tapping a notification opens the app and then this: go where it points
    // (the plugin holds a tap from a closed app until this listens).
    onNative<{ notification?: { data?: { url?: string } } }>("PushNotifications", "pushNotificationActionPerformed", (action) => {
      const url = action.notification?.data?.url;
      if (url && url.startsWith("/") && !url.startsWith("//")) window.location.assign(url);
    });
    // The phone can change its token; each opening checks, and a new one
    // replaces the old on the server.
    const old = readPushToken();
    if (!old) return;
    NATIVE_PUSH.checkPermissions()
      .then(async (permission) => {
        if (permission !== "granted") return;
        const token = await pushTokenFromPhone(platform);
        if (token === old) return;
        const post = await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(tokenBody(platform, token)) });
        if (!post.ok) return;
        rememberPushToken(token);
        await fetch("/api/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: old }) });
      })
      .catch(() => {});
  }, []);
  return null;
}
