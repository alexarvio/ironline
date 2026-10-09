import { notFound } from "next/navigation";
import { requireCoach } from "../../../../../lib/auth";
import NotificationsStateScreen from "../../NotificationsStateScreen";
import { COACH, notificationsProps, STATES, type StateId } from "../../states";
import "../../../home-states/home-states.css";

// One state of the client's Notifications screen, full size, from the board's made-up data.
//   /admin/redesign/notifications-states/screen/today
export const dynamic = "force-dynamic";

export default async function NotificationsStatePage({ params }: { params: Promise<{ state: string }> }) {
  await requireCoach();
  const { state } = await params;
  if (!STATES.some((s) => s.id === state)) notFound();
  return (
    <div className="hs-full">
      <NotificationsStateScreen items={notificationsProps(state as StateId)} coachName={COACH} />
    </div>
  );
}
