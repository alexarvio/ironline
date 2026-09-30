"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { nativePlatform } from "../lib/native";
import { fcmTokenFromPhone, forgetFcmToken, NATIVE_PUSH, readFcmToken, rememberFcmToken } from "./NativePush";

// "Notifications on this phone": asks the phone for permission, subscribes
// it with the push service and hands the address to /api/push (see
// lib/push.ts). Per device, so it lives in the browser, not in the client's
// preferences: turning it on here says nothing about their other phone.
// In the Android app it is the phone's own notifications instead, through
// Firebase (NativePush.tsx); the iPhone app has none yet.

type State = "loading" | "off" | "on" | "busy" | "blocked" | "install" | "unsupported";

function supported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

// On an iPhone, web push only exists for an app added to the Home Screen.
function iosInBrowser() {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function send(method: "POST" | "DELETE" | "PUT", body: unknown) {
  const res = await fetch("/api/push", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`push ${method} ${res.status}`);
  return (await res.json()) as { on: boolean };
}

const noSubscribe = () => () => {};

export default function PushToggle({ publicKey, nativeReady }: { publicKey: string | null; nativeReady: boolean }) {
  const platform = useSyncExternalStore(noSubscribe, nativePlatform, () => null);
  if (platform === "android") return <NativePushToggle ready={nativeReady} />;
  if (platform === "ios") return null;
  return publicKey ? <WebPushToggle publicKey={publicKey} /> : null;
}

function NativePushToggle({ ready }: { ready: boolean }) {
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    let live = true;
    (async () => {
      if (!ready) return setState("unsupported");
      const permission = await NATIVE_PUSH.checkPermissions();
      if (permission === "denied") return setState("blocked");
      const token = readFcmToken();
      const on = permission === "granted" && token ? (await send("PUT", { endpoint: token }).catch(() => ({ on: false }))).on : false;
      if (live) setState(on ? "on" : "off");
    })().catch(() => live && setState("off"));
    return () => {
      live = false;
    };
  }, [ready]);

  async function turnOn() {
    setState("busy");
    try {
      const permission = await NATIVE_PUSH.requestPermissions();
      if (permission !== "granted") return setState(permission === "denied" ? "blocked" : "off");
      const token = await fcmTokenFromPhone();
      await send("POST", { fcm: token });
      rememberFcmToken(token);
      setState("on");
    } catch (error) {
      console.error("Turning on notifications failed:", error);
      setState("off");
    }
  }

  async function turnOff() {
    setState("busy");
    const token = readFcmToken();
    if (token) await send("DELETE", { endpoint: token }).catch(() => {});
    await forgetFcmToken();
    setState("off");
  }

  const detail =
    state === "blocked"
      ? "Blocked for Ironline in your phone's settings"
      : state === "unsupported"
        ? "Not available yet"
        : "On your lock screen, even with the app closed";
  return <ToggleRow on={state === "on"} disabled={state === "loading" || state === "busy" || state === "blocked" || state === "unsupported"} detail={detail} onClick={state === "on" ? turnOff : turnOn} />;
}

function ToggleRow({ on, disabled, detail, onClick }: { on: boolean; disabled: boolean; detail: string; onClick: () => void }) {
  return (
    <button type="button" className="settings-toggle-row" onClick={onClick} disabled={disabled} aria-pressed={on}>
      <div className="home-dark-row-body">
        <div className="home-dark-row-title">Notifications on this phone</div>
        <div className="home-dark-row-detail">{detail}</div>
      </div>
      <span className={`settings-switch${on ? " on" : ""}`} aria-hidden="true">
        <span className="settings-switch-knob" />
      </span>
    </button>
  );
}

function WebPushToggle({ publicKey }: { publicKey: string }) {
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    let live = true;
    (async () => {
      if (!supported()) return setState(iosInBrowser() ? "install" : "unsupported");
      if (Notification.permission === "denied") return setState("blocked");
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      // The phone can hold a subscription the server has dropped (the push
      // service said it was gone); only both together count as on.
      const on = sub ? (await send("PUT", { endpoint: sub.endpoint }).catch(() => ({ on: false }))).on : false;
      if (live) setState(on ? "on" : "off");
    })().catch(() => live && setState("off"));
    return () => {
      live = false;
    };
  }, []);

  async function turnOn() {
    setState("busy");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "blocked" : "off");
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
      await send("POST", sub.toJSON());
      setState("on");
    } catch (error) {
      console.error("Turning on notifications failed:", error);
      setState("off");
    }
  }

  async function turnOff() {
    setState("busy");
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await send("DELETE", { endpoint: sub.endpoint }).catch(() => {});
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setState("on");
    }
  }

  const detail =
    state === "install"
      ? "Add Ironline to your Home Screen first: Share, then Add to Home Screen"
      : state === "blocked"
        ? "Blocked for Ironline in your phone's settings"
        : state === "unsupported"
          ? "This browser can't show notifications"
          : "On your lock screen, even with the app closed";
  const disabled = state === "loading" || state === "busy" || state === "install" || state === "blocked" || state === "unsupported";
  return <ToggleRow on={state === "on"} disabled={disabled} detail={detail} onClick={state === "on" ? turnOff : turnOn} />;
}
