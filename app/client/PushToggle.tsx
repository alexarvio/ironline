"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { nativePlatform, type NativePlatform } from "../lib/native";
import { forgetPushToken, NATIVE_PUSH, pushTokenFromPhone, readPushToken, rememberPushToken, tokenBody } from "./NativePush";

// "Notifications on this phone": asks the phone for permission, subscribes
// it with the push service and hands the address to /api/push (see
// lib/push.ts). Per device, so it lives in the browser, not in the client's
// preferences: turning it on here says nothing about their other phone.
// In the phone apps it is the phone's own notifications instead
// (NativePush.tsx): Apple's on an iPhone (12 Nov, Alex: the switch did
// nothing there, as the app had no push of its own), Firebase on Android.

// "turning-on" and "turning-off" draw the switch where it is going, so a tap moves it at once (the knob eases there)
// while the phone's question and the server answer; a failure puts it back.
type State = "loading" | "off" | "on" | "turning-on" | "turning-off" | "blocked" | "install" | "unsupported";

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

/** What a switch row draws: the client's Settings row, or the coach's phone's own (21 Oct, app/coach). */
export type PushRowProps = { on: boolean; disabled: boolean; detail: string; onClick: () => void };

/** Which phone apps the server can send to (lib/push.ts nativePushReady). */
export type NativeReady = { android: boolean; ios: boolean };

/** The row's look for a state: on where it is going, a short fact only when something is wrong (3 Nov, Alex: the words audit). */
function rowOf(state: State, turnOn: () => void, turnOff: () => void): PushRowProps {
  const on = state === "on" || state === "turning-on";
  const detail = state === "install" ? "Add to Home Screen first" : state === "blocked" ? "Blocked in phone settings" : state === "unsupported" ? "Not available" : "";
  const disabled = state !== "on" && state !== "off";
  return { on, disabled, detail, onClick: state === "on" ? turnOff : turnOn };
}

export default function PushToggle({ publicKey, nativeReady }: { publicKey: string | null; nativeReady: NativeReady }) {
  return <PushSwitch publicKey={publicKey} nativeReady={nativeReady} row={(p) => <ToggleRow {...p} />} />;
}

/** The phone's notifications on or off, the right way for where it runs (the iPhone or Android app, a browser), drawn by `row`. */
export function PushSwitch({ publicKey, nativeReady, row }: { publicKey: string | null; nativeReady: NativeReady; row: (p: PushRowProps) => ReactNode }) {
  const platform = useSyncExternalStore(noSubscribe, nativePlatform, () => null);
  if (platform) return <NativePushToggle key={platform} platform={platform} ready={nativeReady[platform]} row={row} />;
  return publicKey ? <WebPushToggle publicKey={publicKey} row={row} /> : null;
}

function NativePushToggle({ platform, ready, row }: { platform: NativePlatform; ready: boolean; row: (p: PushRowProps) => ReactNode }) {
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    let live = true;
    const check = async () => {
      if (!ready) return setState("unsupported");
      const permission = await NATIVE_PUSH.checkPermissions();
      if (permission === "denied") return live && setState("blocked");
      const token = readPushToken();
      const on = permission === "granted" && token ? (await send("PUT", { endpoint: token }).catch(() => ({ on: false }))).on : false;
      if (live) setState((s) => (s === "turning-on" || s === "turning-off" ? s : on ? "on" : "off"));
    };
    check().catch(() => live && setState("off"));
    // Turned on in the phone's Settings and back in the app: the switch can be used again.
    const back = () => document.visibilityState === "visible" && check().catch(() => {});
    document.addEventListener("visibilitychange", back);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", back);
    };
  }, [ready]);

  async function turnOn() {
    setState("turning-on");
    try {
      const permission = await NATIVE_PUSH.requestPermissions();
      if (permission !== "granted") return setState(permission === "denied" ? "blocked" : "off");
      const token = await pushTokenFromPhone(platform);
      await send("POST", tokenBody(platform, token));
      rememberPushToken(token);
      setState("on");
    } catch (error) {
      console.error("Turning on notifications failed:", error);
      setState("off");
    }
  }

  async function turnOff() {
    setState("turning-off");
    const token = readPushToken();
    if (token) await send("DELETE", { endpoint: token }).catch(() => {});
    await forgetPushToken(platform);
    setState("off");
  }

  return <>{row(rowOf(state, turnOn, turnOff))}</>;
}

function ToggleRow({ on, disabled, detail, onClick }: PushRowProps) {
  return (
    <button type="button" className="settings-toggle-row" onClick={onClick} disabled={disabled} aria-pressed={on}>
      <div className="home-dark-row-body">
        <div className="home-dark-row-title">Notifications on this phone</div>
        {detail && <div className="home-dark-row-detail">{detail}</div>}
      </div>
      <span className={`settings-switch${on ? " on" : ""}`} aria-hidden="true">
        <span className="settings-switch-knob" />
      </span>
    </button>
  );
}

function WebPushToggle({ publicKey, row }: { publicKey: string; row: (p: PushRowProps) => ReactNode }) {
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
    setState("turning-on");
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
    setState("turning-off");
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

  return <>{row(rowOf(state, turnOn, turnOff))}</>;
}
