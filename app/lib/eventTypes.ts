// The client's event types (9 Oct): fixed, six of them, each with its colour
// and icon. An event's `kind` is one of these ids when the client added it;
// a coach's category that isn't one of them (Family, their own) reads as
// Other on the client. The coach side keeps its own categories.

export type EventTypeId = "trip" | "health" | "work" | "supplement" | "training" | "other";

export type EventType = {
  id: EventTypeId;
  label: string;
  /** The colour as a hex, and as "r,g,b" for rgba() tints. */
  color: string;
  rgb: string;
  /** A 24×24 stroke path. */
  icon: string;
  /** The title box's hint. */
  placeholder: string;
  /** A start marker rather than a stretch: the sheet opens on One day. */
  oneDay?: boolean;
};

export const EVENT_TYPES: EventType[] = [
  { id: "trip", label: "Trip", color: "#2f5d8f", rgb: "47,93,143", icon: "M10.5 13.5 3 11l1.5-1.5 7.5 1 4-4.5c1-1 2.6-1.3 3.2-.7s.3 2.2-.7 3.2l-4.5 4 1 7.5L13.5 21z", placeholder: "e.g. Japan with friends" },
  { id: "health", label: "Health", color: "#b8471f", rgb: "184,71,31", icon: "M9.5 4h5v5.5H20v5h-5.5V20h-5v-5.5H4v-5h5.5z", placeholder: "e.g. Sprained my ankle" },
  { id: "work", label: "Work", color: "#5b6472", rgb: "91,100,114", icon: "M4 8h16v11H4zM9 8V5h6v3M4 13h16", placeholder: "e.g. Business trip to Berlin" },
  { id: "supplement", label: "Supplement", color: "#1f7a4d", rgb: "31,122,77", icon: "M10.5 3.5a5 5 0 0 1 7 7l-7 7a5 5 0 0 1-7-7zM7 7l7 7", placeholder: "e.g. Creatine, 5 g a day", oneDay: true },
  { id: "training", label: "Training", color: "#4c42a8", rgb: "76,66,168", icon: "M6.5 8v8M17.5 8v8M4 10v4M20 10v4M6.5 12h11", placeholder: "e.g. Home workouts only" },
  { id: "other", label: "Other", color: "#a8761f", rgb: "168,118,31", icon: "M4 6h16v14H4zM4 10h16M9 3v4M15 3v4", placeholder: "e.g. Wedding" },
];

const OTHER = EVENT_TYPES[EVENT_TYPES.length - 1];

/** The type for an event's kind; anything that isn't one of the six is Other. */
export const eventTypeOf = (kind: string | null | undefined): EventType => EVENT_TYPES.find((t) => t.id === kind) ?? OTHER;

export const isEventTypeId = (s: string | null | undefined): s is EventTypeId => EVENT_TYPES.some((t) => t.id === s);
