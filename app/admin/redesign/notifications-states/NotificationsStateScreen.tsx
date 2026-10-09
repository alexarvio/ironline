"use client";

import NotificationsScreen, { type NotifView } from "../../../client/notifications/NotificationsScreen";

// The client's Notifications screen inside a phone, from the board's
// made-up data, in the pushed layer it lives in within the app. Back and the
// rows go nowhere here.
export default function NotificationsStateScreen({ items, coachName }: { items: NotifView[]; coachName: string }) {
  return (
    <div className="phone-frame hs-frame">
      <div className="app-screen app-stack">
        <div className="app-layer app-layer-push cn-screen">
          <NotificationsScreen items={items} clientId={0} coachName={coachName} />
        </div>
      </div>
    </div>
  );
}
