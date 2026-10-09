import { notFound } from "next/navigation";
import { requireCoach } from "../../../../../lib/auth";
import EventsStateScreen from "../../EventsStateScreen";
import { COACH, eventsProps, STATES, TODAY, type StateId } from "../../states";
import "../../events-states.css";

// One state of the client's Events screen, full size, from the board's made-up data.
//   /admin/redesign/events-states/screen/now
export const dynamic = "force-dynamic";

export default async function EventsStatePage({ params }: { params: Promise<{ state: string }> }) {
  await requireCoach();
  const { state } = await params;
  if (!STATES.some((s) => s.id === state)) notFound();
  return (
    <div className="es-full">
      <EventsStateScreen events={eventsProps(state as StateId)} coachName={COACH} today={TODAY} />
    </div>
  );
}
