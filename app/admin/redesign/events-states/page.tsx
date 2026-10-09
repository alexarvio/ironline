import { requireCoach } from "../../../lib/auth";
import { SIZE } from "../onboarding/flows";
import { STATES } from "./states";
import "../training/draft.css";
import "../onboarding/onboarding.css";
import "./events-states.css";

// The Events states board (9 Oct): the client's Events screen with nothing
// yet, things coming, one running, and a past, side by side from made-up
// data. Each frame is the real screen (Open shows it full size). Local
// only, like the Home board.
//   /admin/redesign/events-states
export const dynamic = "force-dynamic";

export default async function EventsStatesBoard() {
  await requireCoach();
  const size = SIZE.phone;
  return (
    <div className="rd-page ob">
      <h1 className="ob-title">Events, in every state</h1>
      <p className="es-intro">Made-up data, the real screen. Add sits on top; Coming up, then Past. The client&rsquo;s own rows open the sheet; Finlay&rsquo;s show his note on a tap.</p>
      <ol className="ob-steps">
        {STATES.map((s, i) => {
          const href = `/admin/redesign/events-states/screen/${s.id}`;
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
