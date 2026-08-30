"use client";

import { createContext, useContext } from "react";

// Check-in is a full-screen pushed view (its own header, its own save bar,
// no bottom nav), so AppShell owns it the same way it owns Chat and
// Notifications. But it's opened from a due item inside HomeHub, which
// AppShell renders as opaque server-rendered content and so can't hand a
// callback to directly. This context bridges the two: AppShell provides the
// opener, HomeHub's due rows call it.
const CheckInContext = createContext<((section: string) => void) | null>(null);

export const CheckInProvider = CheckInContext.Provider;

export function useOpenCheckIn() {
  return useContext(CheckInContext);
}

// Same bridge for the chat push view — Home's coach notes open the thread
// the note came from.
const ChatContext = createContext<(() => void) | null>(null);

export const ChatProvider = ChatContext.Provider;

export function useOpenChat() {
  return useContext(ChatContext);
}
