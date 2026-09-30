// The native app (mobile/, Capacitor) loads this site from its server, so the
// site has no Capacitor package: the app injects window.Capacitor, and these
// are the calls its registerPlugin makes underneath. Browser-only; in a normal
// browser nativeApp() is null and everything else here does nothing.

type Cap = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  nativePromise?: (plugin: string, method: string, options?: object) => Promise<unknown>;
  addListener?: (plugin: string, event: string, callback: (data: unknown) => void) => unknown;
};

export function nativeApp(): Cap | null {
  if (typeof window === "undefined") return null;
  const c = (window as { Capacitor?: Cap }).Capacitor;
  return c?.isNativePlatform?.() && c.nativePromise ? c : null;
}

export type NativePlatform = "ios" | "android";

export function nativePlatform(): NativePlatform | null {
  const p = nativeApp()?.getPlatform?.();
  return p === "ios" || p === "android" ? p : null;
}

/** Calls a native plugin method; throws outside the app. */
export function callNative<T>(plugin: string, method: string, options?: object): Promise<T> {
  const c = nativeApp();
  if (!c?.nativePromise) return Promise.reject(new Error("Not in the Ironline app"));
  return c.nativePromise(plugin, method, options) as Promise<T>;
}

/** Listens for a native plugin event (for the life of the page). */
export function onNative<T>(plugin: string, event: string, callback: (data: T) => void) {
  nativeApp()?.addListener?.(plugin, event, callback as (data: unknown) => void);
}
