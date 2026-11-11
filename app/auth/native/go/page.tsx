import { redirect } from "next/navigation";
import { clerkOn } from "../../../lib/clerk";
import { NativeStart } from "./NativeStart";

// In the app's secure sign-in sheet, after /auth/native/start: Clerk takes the person to Google.
export const dynamic = "force-dynamic";

export default function NativeGoPage() {
  if (!clerkOn()) redirect("/login");
  return <NativeStart />;
}
