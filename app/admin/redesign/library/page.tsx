import { requireCoach } from "../../../lib/auth";
import { loadRail } from "../loaders";
import RedesignRail from "../RedesignRail";
import LibraryDraft from "./LibraryDraft";
import { loadLibrary } from "./load";
import "../../../components/ui/ui.css";
import "../training/draft.css";
import "../rail.css";
import "./library.css";

// The coach's Library (5 Oct): exercises with their demos and default cues,
// and cardio movements, in one place.
//   /admin/redesign/library
export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const coach = await requireCoach();
  return (
    <div className="rd-frame">
      <RedesignRail rail={loadRail(coach)} clientId={0} />
      <div className="rd-page">
        <LibraryDraft data={loadLibrary(coach.id)} />
      </div>
    </div>
  );
}
