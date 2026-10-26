"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import NewClientDialog from "../NewClientDialog";
import RedesignRail from "./RedesignRail";
import type { RailData } from "./loaders";
import "./training/draft.css";
import "./training/trn.css";
import "./measurements/measurements.css";

// A coach with no clients yet (a new coach, just approved): the rail as always, and one thing to do in the page, add
// the first client. Every client tab lands here while the list is empty. In the admin's voice (26 Oct, Alex: the old
// welcome with its sentence and navy button was left over): `Clients` as Training's bare header, then one hairline
// card, `No clients yet` and New client, as NoPhase says it.
export default function NoClients({ rail }: { rail: RailData }) {
  // From the welcome steps' "Add your first client" (?add=1): the dialog opens straight away.
  const [adding, setAdding] = useState(useSearchParams().get("add") === "1");
  return (
    <div className="rd-frame">
      <RedesignRail rail={rail} clientId={0} />
      <div className="rd-page">
        <div className="rd trn rls">
          <header className="trn-head bare">
            <div className="trn-head-main">
              <div className="trn-name-row">
                <h1 className="trn-name">Clients</h1>
              </div>
            </div>
          </header>
          <section className="rls-section">
            <div className="rls-card">
              <div className="rls-empty">
                <span>No clients yet</span>
                <button type="button" className="trn-btn primary" onClick={() => setAdding(true)}>
                  New client
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
      {adding && <NewClientDialog look="hairline" inviteReady={rail.inviteReady} clerk={rail.clerk} onClose={() => setAdding(false)} />}
    </div>
  );
}
