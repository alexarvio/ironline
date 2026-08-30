import { ChatIcon } from "../components/icons";
import type { HeaderPlan } from "../lib/queries";

// The identity strip above the section tabs: who this is, the two plans
// they're currently on, and a way to message them. Everything else a coach
// might want here lives one click away in the tab it belongs to, or in the
// rail on the right.
export default function ClientHeader({
  name,
  plans,
  messageHref,
}: {
  name: string;
  plans: HeaderPlan[];
  messageHref: string;
}) {
  return (
    <header className="ad-client-header">
      <h1 className="ad-client-title">{name}</h1>

      <div className="ad-client-readouts">
        {plans.map((p) => (
          <div key={p.id} className="ad-plan">
            <div className="ad-microlabel">{p.label}</div>
            <div className="ad-plan-value">{p.value}</div>
          </div>
        ))}
        <a href={messageHref} className="ad-btn">
          <ChatIcon />
          Message
        </a>
      </div>
    </header>
  );
}
