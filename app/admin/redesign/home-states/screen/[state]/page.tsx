import { notFound } from "next/navigation";
import { requireCoach } from "../../../../../lib/auth";
import HomeStateScreen from "../../HomeStateScreen";
import { homeProps, STATES, type StateId } from "../../states";
import "../../home-states.css";

// One state of the client's Home, full size, from the board's made-up data.
//   /admin/redesign/home-states/screen/naked
export const dynamic = "force-dynamic";

export default async function HomeStatePage({ params }: { params: Promise<{ state: string }> }) {
  await requireCoach();
  const { state } = await params;
  if (!STATES.some((s) => s.id === state)) notFound();
  return (
    <div className="hs-full">
      <HomeStateScreen props={homeProps(state as StateId)} />
    </div>
  );
}
