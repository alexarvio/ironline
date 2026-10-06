import { exerciseClientCounts, exerciseGroup, listCoachVideos, listExercises, MUSCLE_GROUPS } from "../../../lib/queries";

// The coach's Library page (5 Oct): every exercise of theirs, its group, its
// demo, its default cue, and how many of their clients have it in a
// programme; cardio movements are the exercises filed under Cardio; and the
// coach's own video library, each clip with the exercises that use it.

export type LibraryItem = {
  id: number;
  name: string;
  group: string;
  /** A link (YouTube…) or an upload (/uploads/…); null without one. */
  video: string | null;
  cue: string;
  clients: number;
  /** Taken out of the library: not offered any more, still where it is prescribed. */
  archived: boolean;
  /** Close grip, wide grip…: each with its own demo (a video path or link), or none yet. */
  variations: { id: number; name: string; video: string | null; /** Its own default cue; empty: the exercise's. */ cue: string }[];
};
export type LibraryVideo = { id: number; path: string; name: string; at: string; /** File size; null for clips uploaded before it was kept. */ bytes: number | null; usedBy: { id: number; name: string }[] };
export type LibraryData = { groups: { slug: string; label: string }[]; items: LibraryItem[]; videos: LibraryVideo[] };

export function loadLibrary(coachId: number): LibraryData {
  const counts = exerciseClientCounts(coachId);
  const exercises = listExercises(coachId);
  return {
    groups: MUSCLE_GROUPS.map((g) => ({ slug: g.slug, label: g.label })),
    items: exercises.map((e) => ({
      id: e.id,
      name: e.name,
      group: exerciseGroup(e),
      video: e.video_url,
      cue: e.cue ?? "",
      clients: counts.get(e.id) ?? 0,
      archived: !!e.archived,
      variations: (e.variations ?? []).map((v) => ({ id: v.id, name: v.name, video: v.video_url, cue: v.cue ?? "" })),
    })),
    videos: listCoachVideos(coachId).map((v) => ({ id: v.id, path: v.path, name: v.name, at: v.at, bytes: v.bytes ?? null, usedBy: exercises.flatMap((e) => [...(e.video_url === v.path ? [{ id: e.id, name: e.name }] : []), ...(e.variations ?? []).filter((x) => x.video_url === v.path).map(() => ({ id: e.id, name: e.name }))]).filter((x, i, all) => all.findIndex((y) => y.id === x.id) === i) })),
  };
}
