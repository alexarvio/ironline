import type { Metadata, Viewport } from "next";
import { requireCoach } from "../lib/auth";
import { getCoachProfile, localDateStr } from "../lib/queries";
import { loadPhoneCalendar } from "./calendar";
import { listPhoneVideos } from "../lib/coachPhone";
import { pushPublicKey } from "../lib/push";
import { fcmConfigured } from "../lib/fcm";
import { loadChatDock } from "../admin/redesign/loaders";
import CoachApp from "./CoachApp";
import "./coach.css";

// The coach's phone (21 Oct, Alex: built from the mockup): answer every
// client's chat, reply to the videos they send from an exercise, and since
// 22 Oct the coach's Calendar. Phases, programmes and everything else stay
// on the laptop (/admin/redesign). The native app opens here when a coach
// signs in (NativeCoachRedirect); in a phone's browser it is just this address.
//   /coach              the chats
//   /coach?tab=videos   the videos
//   /coach?tab=calendar the calendar
//   /coach?c=ID         one client's chat
//   /coach?v=ID         one video, to review
export const dynamic = "force-dynamic";

// Its own manifest (public/coach.webmanifest): added to an iPhone's Home Screen it opens here, not on the client app,
// and an iPhone gets web push only from a Home Screen app.
export const metadata: Metadata = { title: "NorCoach", manifest: "/coach.webmanifest" };
export const viewport: Viewport = { themeColor: "#F5F6F8" };

export default async function CoachPage() {
  const coach = await requireCoach();
  const profile = getCoachProfile(coach.id);
  const local = coach.email.split("@")[0] ?? "";
  const name = profile?.display_name?.trim() || local.split(/[._-]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ") || "Coach";
  // This week of the Calendar comes with the page, so its tab opens at once.
  const today = localDateStr();
  const monday = new Date(`${today}T12:00:00`);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return (
    <CoachApp
      inbox={{ chats: loadChatDock(coach), videos: listPhoneVideos(coach.id) }}
      calendar={loadPhoneCalendar(coach.id, localDateStr(monday), today)}
      today={today}
      coach={{ name, photoPath: profile?.avatar_path ?? null }}
      push={{ publicKey: pushPublicKey(), nativeReady: fcmConfigured() }}
    />
  );
}
