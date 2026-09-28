"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import NewClientDialog from "../NewClientDialog";
import RedesignRail from "./RedesignRail";
import type { RailData } from "./loaders";

// A coach with no clients yet (a new coach, just approved): the rail as
// always, and one clear thing to do in the page, add the first client.
// Every client tab lands here while the list is empty (26 Sep; it was a
// bare "No clients yet." line with no way anywhere).
export default function NoClients({ rail }: { rail: RailData }) {
  // From the welcome steps' "Add your first client" (?add=1): the dialog opens straight away.
  const [adding, setAdding] = useState(useSearchParams().get("add") === "1");
  const first = rail.coach.name.split(" ")[0] || rail.coach.name;
  return (
    <div className="rd-frame">
      <RedesignRail rail={rail} clientId={0} />
      <div className="rd-page">
        <div className="rnc">
          <h1 className="rnc-title">Welcome, {first}</h1>
          <p className="rnc-lead">
            Add your first client to get going. {rail.clerk ? "They get an email with a link to join the app." : "You give them their login, or email it from here."}
          </p>
          <button type="button" className="rd-btn primary rnc-btn" onClick={() => setAdding(true)}>
            New client
          </button>
        </div>
      </div>
      {adding && <NewClientDialog inviteReady={rail.inviteReady} clerk={rail.clerk} onClose={() => setAdding(false)} />}
    </div>
  );
}
