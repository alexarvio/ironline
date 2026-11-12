"use client";

import { useSyncExternalStore } from "react";
import { keyboardCovered, subscribeKeyboard } from "./keyboard";

// How much of the page as it is laid out now the on-screen keyboard covers, from the one keyboard source (keyboard.ts):
// in a phone's browser what the visual viewport leaves out, in the iPhone app the plugin's height until the web view
// has shrunk to the keyboard (then nothing, the layout ends at it). A sheet pinned to the bottom lifts by this to keep
// what is being typed in view, and never lifts twice once the app has shrunk the page. 0 with no keyboard (and on a
// computer). The same figure is `--kb` on <html>, for CSS.
export function useKeyboardInset(): number {
  return useSyncExternalStore(subscribeKeyboard, keyboardCovered, () => 0);
}
