import type { Metadata, Viewport } from "next";
import { requireCoach } from "../lib/auth";
import { getCoachProfile } from "../lib/queries";
import { listPhoneVideos } from "../lib/coachPhone";
import { loadChatDock } from "../admin/redesign/loaders";
import CoachApp from "./CoachApp";
import "./coach.css";

// The coach's phone (21 Oct, Alex: built from the mockup). Two things only:
// answer every client's chat, and reply to the videos they send from an
// exercise. Phases, programmes and everything else stay on the laptop
// (/admin/redesign). The native app opens here when a coach signs in
// (NativeCoachRedirect); in a phone's browser it is just this address.
//   /coach              the chats
//   /coach?tab=videos   the videos
//   /coach?c=ID         one client's chat
//   /coach?v=ID         one video, to review
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "NorCoach" };
export const viewport: Viewport = { themeColor: "#F5F6F8" };

export default async function CoachPage() {
  const coach = await requireCoach();
  const profile = getCoachProfile(coach.id);
  const local = coach.email.split("@")[0] ?? "";
  const name = profile?.display_name?.trim() || local.split(/[._-]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ") || "Coach";
  return <CoachApp inbox={{ chats: loadChatDock(coach), videos: listPhoneVideos(coach.id) }} coach={{ name, photoPath: profile?.avatar_path ?? null }} />;
}
