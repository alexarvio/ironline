// Why a client needs the coach (14 Oct, the sidebar): one of five kinds,
// each with a colour, an icon and a rank. The rail sorts "Needs you" by the
// rank, then by how long the oldest open item has waited.

export type AttentionType = "message" | "video" | "checkin" | "invoice" | "phase";

export type AttentionReason = {
  type: AttentionType;
  /** Composed on the server, so the rail, the client's Home and the feed say the same thing. */
  text: string;
  /** When the oldest open item of this kind arrived (epoch ms); 0 for a standing state. */
  since: number;
  /** The coach can mark it handled; invoices and check-ins clear themselves. */
  clearable: boolean;
  /** The Home action behind it, for "Mark handled". */
  actionId: string;
};

export const ATTENTION: Record<AttentionType, { label: string; color: string; rgb: string; icon: string; rank: number }> = {
  invoice: { label: "Invoice", color: "#b8471f", rgb: "184,71,31", icon: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6", rank: 0 },
  checkin: { label: "Missed check-ins", color: "#a8761f", rgb: "168,118,31", icon: "M9 11l3 3 8-8M20 12v7H4V5h11", rank: 1 },
  video: { label: "Video to review", color: "#3a3390", rgb: "58,51,144", icon: "M8 5v14l11-7z", rank: 2 },
  message: { label: "Message", color: "#1d3466", rgb: "29,52,102", icon: "M4 5h16v11H9l-5 4z", rank: 3 },
  phase: { label: "Phase ending", color: "#1f7a4d", rgb: "31,122,77", icon: "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", rank: 4 },
};

/** The order "Needs you" lists reasons in: the most pressing kind first, then the one waiting longest. */
export function sortReasons(list: AttentionReason[]): AttentionReason[] {
  return [...list].sort((a, b) => ATTENTION[a.type].rank - ATTENTION[b.type].rank || (a.since || Infinity) - (b.since || Infinity));
}
