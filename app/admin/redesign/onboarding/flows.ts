// The onboarding board's flows, in order: each step a screen, shown as the
// app shows it. `screen` names a page under ./screen/ (the parts of a flow
// that need a signed-out or first-time state drawn on purpose); `src` is a
// real page of the app, as the signed-in coach sees it.
//
// 26 Sep: the flows as they will be once sign-in moves to Clerk (no
// passwords: Apple, Google or an email code). Today's, for comparison, last.

export type Device = "phone" | "desk";
export type Step = { name: string; screen?: string; src?: string; note?: string };
export type Flow = { id: string; title: string; device: Device; steps: Step[] };

export function flows(firstClientId: number | null): Flow[] {
  const clientHome = firstClientId ? `/client?client=${firstClientId}` : "/client";
  return [
    {
      id: "coach",
      title: "A coach signs up",
      device: "desk",
      steps: [
        { name: "Create a coach account", screen: "coach-signup" },
        { name: "The code from the email", screen: "code-coach" },
        { name: "About you", screen: "coach-details" },
        { name: "Waiting for approval", screen: "waiting" },
        { name: "The owner approves", screen: "approvals", note: "Your side, as owner" },
        { name: "First view", src: "/admin/redesign", note: "Yours; a new coach's has no clients" },
      ],
    },
    {
      id: "client-add",
      title: "The coach adds a client",
      device: "desk",
      steps: [
        { name: "New client, empty", screen: "new-client-1" },
        { name: "Member info filled in", screen: "new-client-1-filled" },
        { name: "App access", screen: "new-client-2", note: "Still today's: becomes “Send the invite”" },
        { name: "Lands on their Home", src: firstClientId ? `/admin/redesign/home?client=${firstClientId}` : "/admin/redesign" },
      ],
    },
    {
      id: "client-first",
      title: "The client's first time in",
      device: "phone",
      steps: [
        { name: "The invite email", screen: "invite-email-new" },
        { name: "The invite link lands", screen: "invite-welcome" },
        { name: "The code from the email", screen: "code-client" },
        { name: "Home", src: clientHome },
      ],
    },
    {
      id: "client-again",
      title: "Signing in again",
      device: "phone",
      steps: [
        { name: "Sign in", screen: "signin" },
        { name: "The code from the email", screen: "code-client" },
        { name: "Home", src: clientHome },
      ],
    },
    {
      id: "today",
      title: "Today, before the switch",
      device: "phone",
      steps: [
        { name: "The invite email", screen: "invite-email" },
        { name: "Sign in with a password", screen: "login" },
        { name: "Choose a password", screen: "choose-password" },
        { name: "The owner adds a coach", screen: "coaches" },
      ],
    },
  ];
}

export const SIZE: Record<Device, { w: number; h: number; scale: number }> = {
  phone: { w: 390, h: 844, scale: 0.6 },
  desk: { w: 1440, h: 900, scale: 0.36 },
};
