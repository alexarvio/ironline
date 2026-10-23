"use client";

import { useSyncExternalStore } from "react";

// Settings is one page of folding sections, one open at a time (23 Oct, Alex). The page (SettingsBoard) says which
// section is open (sayOpen) and takes the rail's clicks while it is there (onGoToSetting); the rail marks the open
// section (useOpenSetting) and hands a click on a row to the page (goToSetting), which opens that section and brings
// it into view. On any other page the rail's rows are plain links to /admin/redesign/settings#<key>.

const GO = "rst:go";
const OPEN = "rst:open";
let listening = false;
let open: string | null = null;

/** Opens a section of the Settings page in place (the open one folds). False when the page isn't there. */
export function goToSetting(key: string): boolean {
  if (!listening) return false;
  window.dispatchEvent(new CustomEvent<string>(GO, { detail: key }));
  return true;
}

/** The page takes the rail's clicks while it is there. Returns the cleanup. */
export function onGoToSetting(go: (key: string) => void): () => void {
  const on = (e: Event) => go((e as CustomEvent<string>).detail);
  listening = true;
  window.addEventListener(GO, on);
  return () => {
    listening = false;
    window.removeEventListener(GO, on);
    sayOpen(null);
  };
}

/** The page says which section is open (null: all folded). */
export function sayOpen(key: string | null) {
  if (open === key) return;
  open = key;
  window.dispatchEvent(new Event(OPEN));
}

const subscribe = (changed: () => void) => {
  window.addEventListener(OPEN, changed);
  return () => window.removeEventListener(OPEN, changed);
};

/** The section open on the Settings page, for the rail to mark; null elsewhere or when all are folded. */
export function useOpenSetting(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => open,
    () => null,
  );
}
