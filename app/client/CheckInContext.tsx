"use client";

import { createContext, useContext } from "react";
import type { LinkView } from "../lib/messageLinks";

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

// Same bridge for the Progress pictures push view, opened from Home's
// pictures card and from the row under the Account tab.
const PhotosContext = createContext<(() => void) | null>(null);

export const PhotosProvider = PhotosContext.Provider;

export function useOpenPhotos() {
  return useContext(PhotosContext);
}

// Same bridge for the coach's profile, opened from the Coach row on the
// Account tab. Null when the client has no coach to show.
const CoachContext = createContext<(() => void) | null>(null);

export const CoachProvider = CoachContext.Provider;

export function useOpenCoach() {
  return useContext(CoachContext);
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
const NavigateContext = createContext<((tab: string, ref?: number, focus?: TrainingFocus) => void) | null>(null);

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

// Same bridge for the food diary, opened from the ring on Nutrition.
const FoodContext = createContext<(() => void) | null>(null);

export const FoodProvider = FoodContext.Provider;

export function useOpenFood() {
  return useContext(FoodContext);
}

// Who the coach is, for the small round picture (CoachMark) in front of
// anything they wrote. Null when the client has no coach.
export type CoachIdentity = { name: string; photoPath: string | null };

const CoachIdentityContext = createContext<CoachIdentity | null>(null);

export const CoachIdentityProvider = CoachIdentityContext.Provider;

export function useCoachIdentity() {
  return useContext(CoachIdentityContext);
}

// Same bridge for the coach's messages: the read-only feed opened from the
// card on Home and from a "Coach note" row in Notifications.
const MessagesContext = createContext<(() => void) | null>(null);

export const MessagesProvider = MessagesContext.Provider;

export function useOpenMessages() {
  return useContext(MessagesContext);
}

// Opening what a coach message points at (messageLinks.ts). AppShell knows
// every screen; the message card only knows the link.
const LinkContext = createContext<((view: LinkView) => void) | null>(null);

export const LinkProvider = LinkContext.Provider;

export function useOpenLink() {
  return useContext(LinkContext);
}

// Where a link into Training lands: the week to show (its strip can be on
// any week the client has had) and the exercise to open in the session the
// focus ref names. Null on an ordinary visit.
export type TrainingFocus = { week: number | null; exercise: number | null; /** Home's Start: go straight into starting the session. */ start?: boolean };

const TrainingFocusContext = createContext<TrainingFocus | null>(null);

export const TrainingFocusProvider = TrainingFocusContext.Provider;

export function useTrainingFocus() {
  return useContext(TrainingFocusContext);
}

// Same bridge for the Meetings screen, opened from Home's meeting card and
// the menu. Null outside AppShell's tab content (the screen itself).
const MeetingsContext = createContext<(() => void) | null>(null);

export const MeetingsProvider = MeetingsContext.Provider;

export function useOpenMeetings() {
  return useContext(MeetingsContext);
}
