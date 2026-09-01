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

// Same bridge for the Notifications push view. Home's coach-note rows used
// to open the chat thread the note came from; with chat cut from the first
// beta they open Notifications instead, which is where coach activity now
// lives.
const NotificationsContext = createContext<(() => void) | null>(null);

export const NotificationsProvider = NotificationsContext.Provider;

export function useOpenNotifications() {
  return useContext(NotificationsContext);
}

// And for cross-tab navigation: a notification carries the tab it belongs to
// plus, optionally, the id of the row to open there (see action_ref in
// db.ts). Tapping "your coach sent you a progress report" closes the
// notifications view, switches to Settings, and expands that report.
const NavigateContext = createContext<((tab: string, ref?: number) => void) | null>(null);

export const NavigateProvider = NavigateContext.Provider;

export function useNavigateTab() {
  return useContext(NavigateContext);
}

// The other half of that: whichever row the arriving tab should open. Read
// by the list that owns those rows (ReportArchiveList), so the server
// component in between doesn't have to thread a prop through.
const FocusRefContext = createContext<number | null>(null);

export const FocusRefProvider = FocusRefContext.Provider;

export function useFocusRef() {
  return useContext(FocusRefContext);
}
