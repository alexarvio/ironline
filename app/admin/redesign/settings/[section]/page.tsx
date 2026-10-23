import { notFound, redirect } from "next/navigation";
import { isSettingsKey, settingsHref } from "../../settingsNav";

// Settings was a page per section; it is one page now (23 Oct, Alex), and the old addresses go to their section on
// it, ?stripe= (back from Stripe) and ?coachId= kept.
//   /admin/redesign/settings/account | business | invoicing | privacy → /admin/redesign/settings#<section>
export const dynamic = "force-dynamic";

export default async function SettingsSectionPage({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<{ stripe?: string; coachId?: string }> }) {
  const { section } = await params;
  const { stripe, coachId } = await searchParams;
  if (!isSettingsKey(section)) notFound();
  redirect(settingsHref(section, { coachId, stripe }));
}
