// The client's call types (9 Oct): three, each with a colour and an icon.
// The coach picks one when booking; a call with none is a Check-in.

export type MeetingTypeId = "checkin" | "review" | "other";

export type MeetingType = { id: MeetingTypeId; label: string; color: string; rgb: string; icon: string };

export const MEETING_TYPES: MeetingType[] = [
  { id: "checkin", label: "Check-in", color: "#2f6fd6", rgb: "47,111,214", icon: "M3 7h12v10H3zM15 10.5l6-3.5v10l-6-3.5" },
  { id: "review", label: "Review", color: "#4c42a8", rgb: "76,66,168", icon: "M4 19V5M4 19h16M8 15l3-4 3 2 4-6" },
  { id: "other", label: "Other", color: "#5b6472", rgb: "91,100,114", icon: "M4 5h16v11H9l-5 4z" },
];

export const meetingTypeOf = (id: string | null | undefined): MeetingType => MEETING_TYPES.find((t) => t.id === id) ?? MEETING_TYPES[0];

export const isMeetingTypeId = (s: string | null | undefined): s is MeetingTypeId => MEETING_TYPES.some((t) => t.id === s);
