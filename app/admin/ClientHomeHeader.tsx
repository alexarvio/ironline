import Link from "next/link";
import type { OverviewPanel } from "../lib/queries";

// Who this is: the face, the name, and one button to write to them.
//
// There used to be a chevron here that unfolded age, client since, address
// and email. It was a read-only copy of four of Member info's fields, and
// Member info is on this same screen with an Edit on it — so the fold cost a
// click to reach a worse version of something already in view.
export default function ClientHomeHeader({ clientId, panel }: { clientId: number; panel: OverviewPanel }) {
  return (
    <div className="ch-ident-top">
      <div className="ch-ident">
        <span className="ch-avatar" aria-hidden="true">
          {panel.avatarPath ? (
            // eslint-disable-next-line @next/next/no-img-element -- client-uploaded file
            <img src={panel.avatarPath} alt="" className="ad-avatar-img" />
          ) : (
            panel.initial
          )}
        </span>
        <h2 className="ch-name">{panel.name}</h2>
      </div>
      <Link href={`/admin?client=${clientId}&tab=messages`} className="ch-btn">
        Message
      </Link>
    </div>
  );
}
