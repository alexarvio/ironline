import AdminShell from "../AdminShell";
import AdminSidebar from "../AdminSidebar";
import CoachProfileEditor from "../CoachProfileEditor";
import { isOwner, requireCoach } from "../../lib/auth";
import { getCoachProfileView, listCoachAccounts } from "../../lib/queries";

// "Your profile": the coach writes what their clients read from the Account
// tab, with a live phone preview beside the form. The owner can open any
// coach's profile with ?coachId=.
export const dynamic = "force-dynamic";

export default async function CoachProfilePage({ searchParams }: { searchParams: Promise<{ coachId?: string }> }) {
  const coach = await requireCoach();
  const params = await searchParams;
  const owner = isOwner(coach);
  const asked = Number(params.coachId);
  const coachId = owner && Number.isInteger(asked) && asked > 0 && getCoachProfileView(asked) ? asked : coach.id;
  const profile = getCoachProfileView(coachId);
  const coaches = owner ? listCoachAccounts().map((c) => ({ id: c.id, email: c.email })) : [];

  return (
    <AdminShell sidebar={<AdminSidebar coachId={coach.id} coachEmail={coach.email} selectedId={null} view="profile" isOwner={owner} />}>
      <div className="ad-pad">
        {profile ? (
          <CoachProfileEditor key={coachId} profile={profile} coaches={coaches} currentCoachId={coach.id} />
        ) : (
          <p className="empty-note">This account has no coach profile.</p>
        )}
      </div>
    </AdminShell>
  );
}
