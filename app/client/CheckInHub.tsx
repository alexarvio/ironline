"use client";

import { ReactNode, useState } from "react";

// Deliberately does NOT import from ../lib/queries — a "use client" file that
// does breaks the dev server at runtime (fs can't bundle for the browser).
// All data comes in as plain props, computed server-side in page.tsx.
export type DueItem = { id: string; label: string; detail: string; targetTab: string };
export type CheckInSubTab = { id: string; label: string; content: ReactNode };

export default function CheckInHub({ dueItems, tabs }: { dueItems: DueItem[]; tabs: CheckInSubTab[] }) {
  const [active, setActive] = useState("today");

  return (
    <div>
      <div className="checkin-subtab-strip">
        <button
          type="button"
          className={`checkin-subtab-btn${active === "today" ? " active" : ""}`}
          onClick={() => setActive("today")}
        >
          Today
        </button>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`checkin-subtab-btn${active === t.id ? " active" : ""}`}
            onClick={() => setActive(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {active === "today" ? (
        <div>
          <p className="app-lead">What&rsquo;s due right now. Tap one to fill it in.</p>
          {dueItems.length === 0 ? (
            <p className="empty-note">All caught up, nothing due today.</p>
          ) : (
            <div className="today-list">
              {dueItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="today-card"
                  onClick={() => setActive(item.targetTab)}
                >
                  <div>
                    <div className="today-card-title">{item.label}</div>
                    <div className="today-card-detail">{item.detail}</div>
                  </div>
                  <span className="today-card-cta">Log now →</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        tabs.find((t) => t.id === active)?.content
      )}
    </div>
  );
}
