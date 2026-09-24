"use client";

import { useEffect, useState } from "react";

// "Notifications on this phone": asks the phone for permission, subscribes
// it with the push service and hands the address to /api/push (see
// lib/push.ts). Per device, so it lives in the browser, not in the client's
// preferences: turning it on here says nothing about their other phone.

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

export default function PushToggle({ publicKey }: { publicKey: string }) {
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
  const on = state === "on";
  const disabled = state === "loading" || state === "busy" || state === "install" || state === "blocked" || state === "unsupported";

  return (
    <button type="button" className="settings-toggle-row" onClick={on ? turnOff : turnOn} disabled={disabled} aria-pressed={on}>
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
