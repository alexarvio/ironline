import { redirect } from "next/navigation";
import { settingsHref } from "../settingsNav";

// "Your profile" is the first section of the one Settings page (23 Oct, Alex): the old address goes there, the
// owner's ?coachId= with it.
//   /admin/redesign/profile → /admin/redesign/settings#profile
export const dynamic = "force-dynamic";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ coachId?: string }> }) {
  const { coachId } = await searchParams;
  redirect(settingsHref("profile", { coachId }));
}
