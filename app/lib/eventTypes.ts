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
  /** A filled part drawn over it, where the outline alone reads badly small (the capsule's half). */
  fill?: string;
  /** The title box's hint. */
  placeholder: string;
  /** A start marker rather than a stretch: the sheet opens on One day. */
  oneDay?: boolean;
};

export const EVENT_TYPES: EventType[] = [
  { id: "trip", label: "Trip", color: "#2f5d8f", rgb: "47,93,143", icon: "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z", placeholder: "e.g. Japan with friends" },
  { id: "health", label: "Health", color: "#b8471f", rgb: "184,71,31", icon: "M9.5 4h5v5.5H20v5h-5.5V20h-5v-5.5H4v-5h5.5z", placeholder: "e.g. Sprained my ankle" },
  { id: "work", label: "Work", color: "#a8761f", rgb: "168,118,31", icon: "M4 8h16v11H4zM9 8V5h6v3M4 13h16", placeholder: "e.g. Business trip to Berlin" },
  { id: "supplement", label: "Supplement", color: "#1f7a4d", rgb: "31,122,77", icon: "M10.5 20.5l10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7zM8.5 8.5l7 7", fill: "M3.5 13.5l5-5 7 7-5 5a4.95 4.95 0 0 1-7-7z", placeholder: "e.g. Creatine, 5 g a day", oneDay: true },
  { id: "training", label: "Training", color: "#4c42a8", rgb: "76,66,168", icon: "M6.5 8v8M17.5 8v8M4 10v4M20 10v4M6.5 12h11", placeholder: "e.g. Home workouts only" },
  { id: "other", label: "Other", color: "#7a8290", rgb: "122,130,144", icon: "M4 6h16v14H4zM4 10h16M9 3v4M15 3v4", placeholder: "e.g. Wedding" },
];

const OTHER = EVENT_TYPES[EVENT_TYPES.length - 1];

/** The type for an event's kind; anything that isn't one of the six is Other. */
export const eventTypeOf = (kind: string | null | undefined): EventType => EVENT_TYPES.find((t) => t.id === kind) ?? OTHER;

export const isEventTypeId = (s: string | null | undefined): s is EventTypeId => EVENT_TYPES.some((t) => t.id === s);
