import { isOwner, requireCoach } from "../../../lib/auth";
import { getCoachProfileView, getCoachSettings, listCoachAccounts } from "../../../lib/queries";
import { getData } from "../../../lib/db";
import { COUNTRIES } from "../../../lib/countries";
import { loadRail } from "../loaders";
import RedesignRail from "../RedesignRail";
import ProfileEditor from "./ProfileEditor";
import "../../../components/ui/ui.css";
import "../training/draft.css";
import "../rail.css";
import "./profile.css";

// "Your profile" in the redesign, the rail on its left (replaces
// /admin/profile): the coach writes what their clients read on their Account
// tab, with the client's own screen beside the form. The owner can open any
// coach's profile with ?coachId=.
//   /admin/redesign/profile
export const dynamic = "force-dynamic";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ coachId?: string }> }) {
  const coach = await requireCoach();
  const params = await searchParams;
  const owner = isOwner(coach);
  const asked = Number(params.coachId);
  const coachId = owner && Number.isInteger(asked) && asked > 0 && getCoachProfileView(asked) ? asked : coach.id;
  const profile = getCoachProfileView(coachId);
  const coaches = owner ? listCoachAccounts().map((c) => ({ id: c.id, email: c.email })) : [];
  // Your details: the account basics, beside the public profile.
  const contact = getCoachSettings(coachId).contact ?? {};
  const details = {
    email: getData().users.find((u) => u.id === coachId)?.email ?? "",
    phoneCode: contact.phone_code ?? "",
    phone: contact.phone ?? "",
    address: contact.address ?? "",
    postcode: contact.postcode ?? "",
    city: contact.city ?? "",
    countryCode: contact.country_code ?? "",
  };
  const countries = COUNTRIES.map((c) => ({ code: c.code, name: c.name }));
  return (
    <div className="rd-frame">
      <RedesignRail rail={loadRail(coach)} clientId={0} settings="profile" />
      <div className="rd-page">
        {profile ? <ProfileEditor key={coachId} profile={profile} coaches={coaches} currentCoachId={coach.id} details={details} countries={countries} /> : <p className="rpf-empty">This account has no coach profile.</p>}
      </div>
    </div>
  );
}
