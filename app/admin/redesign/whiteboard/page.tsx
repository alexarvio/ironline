import { requireCoach } from "../../../lib/auth";
import WhiteboardBoard from "./WhiteboardBoard";
import "../training/draft.css";
import "../onboarding/onboarding.css";

// The whiteboard reply, on its own page to try (9 Oct): the recorder as it
// sits in the coach's video dialog, over a sample clip. Sending goes
// nowhere here (there is no request behind it). Local only.
//   /admin/redesign/whiteboard
export const dynamic = "force-dynamic";

export default async function WhiteboardPage() {
  await requireCoach();
  return (
    <div className="rd-page ob">
      <h1 className="ob-title">The whiteboard reply</h1>
      <p className="hs-intro" style={{ marginTop: -22, maxWidth: 640, fontSize: 13.5, lineHeight: 1.5, color: "#5b6474" }}>
        The client&rsquo;s clip under a drawing layer. Press Record, play, pause where it matters, draw, talk. Stop gives the preview; Send is a dead end on this page.
      </p>
      <WhiteboardBoard />
    </div>
  );
}
