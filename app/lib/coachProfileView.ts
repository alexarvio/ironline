// The coach profile as the client's screen and the admin's live preview
// render it. Types and small pure helpers only, so client components can
// import this without pulling in the server store.

export type CoachStudy = { title: string; place: string; year: string };
export type CoachRole = { years: string; role: string; place: string };

/** The fields the coach edits in the admin. */
export type CoachProfileFields = {
  displayName: string;
  title: string;
  headline: string;
  location: string;
  languages: string;
  yearsCoaching: number | null;
  intro: string;
  bio: string;
  quote: string;
  specialties: string[];
  studies: CoachStudy[];
  experience: CoachRole[];
  outside: string;
  replyNote: string;
};

export type CoachProfileView = CoachProfileFields & {
  coachId: number;
  /** Unpublished: the client sees the minimal card (initial, name, email). */
  published: boolean;
  email: string;
  heroPath: string | null;
  candidPath: string | null;
  avatarPath: string | null;
  /** Derived from clients.coach_id, for the "40 clients" pill. */
  clientCount: number;
  updatedAt: string | null;
};

export const COACH_PROFILE_LIMITS = {
  displayName: 80,
  title: 80,
  headline: 120,
  location: 80,
  languages: 80,
  intro: 500,
  bio: 800,
  quote: 140,
  outside: 300,
  replyNote: 80,
  specialties: 8,
} as const;

/** The degree pill: the first study whose title starts MSc, BSc or PhD. */
export function degreeOf(studies: CoachStudy[]): string | null {
  const study = studies.find((s) => /^(MSc|BSc|PhD)\b/i.test(s.title.trim()));
  return study ? study.title.trim() : null;
}

export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || name.trim();
}
