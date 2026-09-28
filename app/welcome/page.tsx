import { redirect } from "next/navigation";
import { requireCoach } from "../lib/auth";
import { getData } from "../lib/db";
import { COUNTRIES } from "../lib/countries";
import { getCoachProfile, getCoachSettings } from "../lib/queries";
import CoachWelcome from "./CoachWelcome";
import "../components/ui/ui.css";
import "../admin/redesign/training/draft.css";
import "../admin/redesign/meetings/meetings.css";
import "./welcome.css";

// The welcome steps for a new coach (CoachWelcome). Only while they are
// marked for them (users.onboarding, set when the owner approves); the
// coach side sends them here until they finish (loadRail).
//   /welcome
export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  const coach = await requireCoach();
  const row = getData().users.find((u) => u.id === coach.id);
  if (!row?.onboarding) redirect("/admin/redesign");
  const profile = getCoachProfile(coach.id);
  const settings = getCoachSettings(coach.id);
  return (
    <CoachWelcome
      data={{
        email: coach.email,
        name: profile?.display_name ?? "",
        title: profile?.title ?? "",
        specialties: profile?.specialties ?? [],
        avatarPath: profile?.avatar_path ?? null,
        business: settings.business?.business_name ?? "",
        countryCode: settings.business?.country_code ?? "",
        timezone: settings.timezone ?? null,
        countries: COUNTRIES.map((c) => ({ code: c.code, name: c.name, currency: c.currency, tax: c.tax, rate: c.rate })),
      }}
    />
  );
}
