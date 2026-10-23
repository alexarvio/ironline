// Features switched off for now (23 Oct, Alex), their data and screens kept so they can come back with one change.
// A plain module: read by the server and the screens alike.
export const FEATURES = {
  /** Variations of an exercise on a session (close grip…; 15 Oct). */
  variations: false,
  /** Substitutes set on the Library and offered when a session has none of its own (14 Oct). Off: a session offers
      only what the coach set on it. */
  librarySubstitutes: false,
  /** A phase's goals (ClientPhase.objectives; 23 Oct, Alex: To focus on replaces them). Off: no Phase goals pill, no goals in
      the phase pop-ups, nothing on the client's screens; the stored goals are kept. */
  phaseGoals: false,
} as const;
