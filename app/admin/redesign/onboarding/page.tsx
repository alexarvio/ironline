import { requireCoach } from "../../../lib/auth";
import { loadRail } from "../loaders";
import { flows, SIZE } from "./flows";
import "../training/draft.css";
import "./onboarding.css";

// The onboarding board: every screen from "no account" to Home, for a new
// coach, a coach adding a client, and a client's first time in, side by
// side and in order. Each frame is the real screen (Open shows it full
// size), so a change made for the board is a change to the app.
// Local only, like the shadcn trial.
//   /admin/redesign/onboarding
export const dynamic = "force-dynamic";

export default async function OnboardingBoard() {
  const coach = await requireCoach();
  const rail = loadRail(coach);
  return (
    <div className="rd-page ob">
      <h1 className="ob-title">Onboarding</h1>
      {flows(rail.clients[0]?.id ?? null).map((f) => {
        const size = SIZE[f.device];
        return (
          <section key={f.id} className="ob-flow" aria-label={f.title}>
            <h2 className="ob-flow-title">{f.title}</h2>
            <ol className="ob-steps">
              {f.steps.map((s, i) => {
                const href = s.src ?? `/admin/redesign/onboarding/screen/${s.screen}`;
                return (
                  <li key={s.name} className="ob-step">
                    <div className="ob-cap">
                      <span className="ob-n">{i + 1}</span>
                      <span className="ob-name">{s.name}</span>
                      <a className="ob-open" href={href} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    </div>
                    <div className={`ob-screen ${f.device}`} style={{ width: size.w * size.scale, height: size.h * size.scale }}>
                      <iframe src={href} title={`${f.title}: ${s.name}`} loading="lazy" style={{ width: size.w, height: size.h, transform: `scale(${size.scale})` }} />
                    </div>
                    {s.note && <span className="ob-note">{s.note}</span>}
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
