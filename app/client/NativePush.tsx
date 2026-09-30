"use client";

import { useEffect } from "react";
import { callNative, nativePlatform, onNative } from "../lib/native";

// Notifications in the Android app: the @capacitor/push-notifications plugin
// gives the phone a Firebase token, /api/push keeps it (kind "fcm") and
// lib/fcm.ts sends to it. The switch is PushToggle; this file holds the
// plugin calls and, mounted once in the app, opens what a tapped
// notification points at.

type Permission = "granted" | "denied" | "prompt" | "prompt-with-rationale";

export const NATIVE_PUSH = {
  checkPermissions: async () => (await callNative<{ receive: Permission }>("PushNotifications", "checkPermissions")).receive,
  requestPermissions: async () => (await callNative<{ receive: Permission }>("PushNotifications", "requestPermissions")).receive,
};

// The token this phone last gave the server, kept on the phone so the switch
// knows what to ask /api/push about.
const KEY = "ironline-fcm-token";
export const readFcmToken = () => {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
};
export const rememberFcmToken = (token: string) => {
  try {
    window.localStorage.setItem(KEY, token);
  } catch {
    /* blocked storage: the switch reads as off next visit */
  }
};

/** Registers with Firebase and resolves with this phone's token. */
export async function fcmTokenFromPhone(): Promise<string> {
  // Android files notifications under a channel the person can mute in
  // Settings; the server sends to this one (lib/fcm.ts).
  await callNative("PushNotifications", "createChannel", { id: "ironline", name: "Coach updates", importance: 4 }).catch(() => {});
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("No token from Firebase")), 20_000);
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

export async function forgetFcmToken() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {}
  await callNative("PushNotifications", "unregister").catch(() => {});
}

export function NativePush() {
  useEffect(() => {
    if (nativePlatform() !== "android") return;
    // Tapping a notification opens the app and then this: go where it points.
    onNative<{ notification?: { data?: { url?: string } } }>("PushNotifications", "pushNotificationActionPerformed", (action) => {
      const url = action.notification?.data?.url;
      if (url && url.startsWith("/") && !url.startsWith("//")) window.location.assign(url);
    });
    // Firebase can change a phone's token; each opening checks, and a new one
    // replaces the old on the server.
    const old = readFcmToken();
    if (!old) return;
    NATIVE_PUSH.checkPermissions()
      .then(async (permission) => {
        if (permission !== "granted") return;
        const token = await fcmTokenFromPhone();
        if (token === old) return;
        const post = await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fcm: token }) });
        if (!post.ok) return;
        rememberFcmToken(token);
        await fetch("/api/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: old }) });
      })
      .catch(() => {});
  }, []);
  return null;
}
