import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { clerkOn } from "../../../lib/clerk";
import { NativeStart } from "./NativeStart";

// In the app's secure sign-in sheet, after /auth/native/start: Clerk takes the person to Google, the start's secret
// number riding along in the return address (read here on the server, as the page itself can't).
export const dynamic = "force-dynamic";

export default async function NativeGoPage() {
  if (!clerkOn()) redirect("/login");
  const nonce = (await cookies()).get("norcoach_native_nonce")?.value ?? "";
  if (!/^[A-Za-z0-9_-]{32}$/.test(nonce)) redirect("norcoach://auth?error=no_state");
  return <NativeStart nonce={nonce} />;
}
