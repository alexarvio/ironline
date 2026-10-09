"use client";

import EventsScreen from "../../../client/EventsScreen";
import type { HomeEvents } from "../../../client/EventsCard";

// The client's Events screen inside a phone, from the board's made-up data,
// in the pushed layer it lives in within the app. Back goes nowhere here.
export default function EventsStateScreen({ events, coachName, today }: { events: HomeEvents; coachName: string; today: string }) {
  return (
    <div className="phone-frame es-frame">
      <div className="app-screen app-stack">
        <div className="app-layer app-layer-push cn-screen">
          <EventsScreen events={events} coachName={coachName} today={today} onBack={() => {}} />
        </div>
      </div>
    </div>
  );
}
