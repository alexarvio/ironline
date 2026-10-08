import { requireCoach } from "../../../lib/auth";
import { SIZE } from "../onboarding/flows";
import { STATES } from "./states";
import "../training/draft.css";
import "../onboarding/onboarding.css";
import "./home-states.css";

// The Home states board (8 Oct): the client's Home with nothing deployed,
// between phases, and with everything on, side by side from made-up data,
// so the empty states can be seen whatever the real clients have. Each
// frame is the real Home (Open shows it full size). Local only, like the
// onboarding board.
//   /admin/redesign/home-states
export const dynamic = "force-dynamic";

export default async function HomeStatesBoard() {
  await requireCoach();
  const size = SIZE.phone;
  return (
    <div className="rd-page ob">
      <h1 className="ob-title">Home, in every state</h1>
      <p className="hs-intro">Made-up data, the real screen. Today, Your plan and the coach are always there; with nothing to show, each says so.</p>
      <ol className="ob-steps">
        {STATES.map((s, i) => {
          const href = `/admin/redesign/home-states/screen/${s.id}`;
          return (
            <li key={s.id} className="ob-step">
              <div className="ob-cap">
                <span className="ob-n">{i + 1}</span>
                <span className="ob-name">{s.name}</span>
                <a className="ob-open" href={href} target="_blank" rel="noreferrer">
                  Open
                </a>
              </div>
              <div className="ob-screen phone" style={{ width: size.w * size.scale, height: size.h * size.scale }}>
                <iframe src={href} title={s.name} loading="lazy" style={{ width: size.w, height: size.h, transform: `scale(${size.scale})` }} />
              </div>
              <span className="ob-note" style={{ maxWidth: size.w * size.scale }}>
                {s.note}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
