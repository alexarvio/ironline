import { redirect } from "next/navigation";
import { clerkOn } from "../../../lib/clerk";
import { NativeStart } from "./NativeStart";

// The iPhone app's Google sign-in (11 Nov, Alex), opened in Apple's secure sign-in sheet (mobile/ios SceneDelegate.swift,
// NorcoachAuth.openSignIn): Google refuses to sign in inside an app's web view. From here Clerk goes to Google and back
// to /auth/native/callback, then /auth/native/finish hands the app a one-time ticket. The sheet keeps nothing afterwards.
export const dynamic = "force-dynamic";

export default async function NativeStartPage({ searchParams }: { searchParams: Promise<{ provider?: string; state?: string }> }) {
  if (!clerkOn()) redirect("/login");
  const { provider, state } = await searchParams;
  // Google alone for now: Apple signs in natively in the app (no page).
  if (provider !== "google" || !state || !/^[A-Za-z0-9_-]{16,128}$/.test(state)) redirect("norcoach://auth?error=bad_request");
  return <NativeStart state={state} />;
}
