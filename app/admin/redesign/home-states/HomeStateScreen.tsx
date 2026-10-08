"use client";

import HomeHub from "../../../client/HomeHub";
import { AppleIcon, ChatIcon, DumbbellIcon, HomeIcon, MenuIcon, BellIcon } from "../../../components/icons";
import type { HomeProps } from "./states";

// The client's Home inside a phone, from the board's made-up data. The
// shell around it is the app's own classes, so it sits as it does in the
// app; nothing on it goes anywhere (no providers behind the buttons).
export default function HomeStateScreen({ props }: { props: HomeProps }) {
  return (
    <div className="phone-frame hs-frame">
      <div className="app-screen app-stack">
        <div className="app-layer app-layer-main">
          <header className="app-header dark overlay clear">
            <button type="button" className="app-header-icon-btn" aria-label="Menu">
              <MenuIcon />
            </button>
            <span className="app-header-brand">Ironline</span>
            <div className="app-header-actions">
              <button type="button" className="app-header-icon-btn" aria-label="Notifications">
                <BellIcon />
              </button>
            </div>
          </header>
          <main className="app-content dark">
            <HomeHub {...props} />
          </main>
          <nav className="app-bottom-nav dark">
            {[
              ["Home", <HomeIcon key="h" />],
              ["Training", <DumbbellIcon key="t" />],
              ["Nutrition", <AppleIcon key="n" />],
              ["Messages", <ChatIcon key="m" />],
            ].map(([label, icon], i) => (
              <button key={String(label)} type="button" className={`app-tab-btn${i === 0 ? " active" : ""}`}>
                <span className="app-tab-icon" aria-label={String(label)}>
                  {icon}
                </span>
              </button>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}
