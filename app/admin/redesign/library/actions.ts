"use server";

import { revalidatePath } from "next/cache";
import { requireCoach } from "../../../lib/auth";
import { coachOwnsExercise } from "../../../lib/tenancy";
import { addCoachVideo, addExercise, listCoachVideos, removeCoachVideo, renameCoachVideo, setExerciseArchived, setExerciseVariations, setExerciseVideoUrl, updateExercise } from "../../../lib/queries";
import { deleteUpload, putUpload } from "../../../lib/storage";

// The coach's Library page (5 Oct): an exercise's name, group and default
// cue, and taking one out of the library. Demos go through the actions the
// Training tab already uses (setExerciseDemoLinkAction,
// uploadExerciseVideoAction, clearExerciseDemoAction in lib/actions.ts).

export async function updateLibraryExerciseAction(exerciseId: number, patch: { name?: string; group?: string; cue?: string | null }): Promise<boolean> {
  const coach = await requireCoach();
  if (!coachOwnsExercise(coach.id, Number(exerciseId))) return false;
  updateExercise(Number(exerciseId), {
    ...(typeof patch.name === "string" ? { name: patch.name } : {}),
    ...(typeof patch.group === "string" ? { group: patch.group } : {}),
    ...(patch.cue !== undefined ? { cue: patch.cue == null ? null : String(patch.cue) } : {}),
  });
  revalidatePath("/admin");
  return true;
}

/** An exercise's variations (close grip, wide grip…), each with its own demo: one of the coach's videos or a link. */
export async function saveExerciseVariationsAction(exerciseId: number, list: { id?: number | null; name: string; video: string | null; cue?: string | null }[]): Promise<boolean> {
  const coach = await requireCoach();
  if (!coachOwnsExercise(coach.id, Number(exerciseId))) return false;
  const mine = new Set(listCoachVideos(coach.id).map((v) => v.path));
  const ok = (url: string | null) => (url && (mine.has(url) || /^https?:\/\//i.test(url)) ? url : null);
  setExerciseVariations(
    Number(exerciseId),
    (Array.isArray(list) ? list : []).map((v) => ({ id: v?.id == null ? null : Number(v.id), name: String(v?.name ?? ""), video_url: ok(typeof v?.video === "string" ? v.video.trim() : null), cue: typeof v?.cue === "string" ? v.cue : null }))
  );
  revalidatePath("/admin");
  revalidatePath("/client");
  return true;
}

export async function archiveLibraryExerciseAction(exerciseId: number, archived: boolean): Promise<boolean> {
  const coach = await requireCoach();
  if (!coachOwnsExercise(coach.id, Number(exerciseId))) return false;
  setExerciseArchived(Number(exerciseId), !!archived);
  revalidatePath("/admin");
  return true;
}

/** A new exercise (or cardio movement, group "cardio") of the coach's own. Its id, or null. */
export async function createLibraryExerciseAction(name: string, group: string, cue: string): Promise<number | null> {
  const coach = await requireCoach();
  const clean = String(name ?? "").trim().slice(0, 60);
  if (!clean) return null;
  const made = addExercise(coach.id, clean, String(group ?? "other"), null);
  if (String(cue ?? "").trim()) updateExercise(made.id, { cue: String(cue) });
  revalidatePath("/admin");
  return made.id;
}

// ---- The coach's video library (5 Oct) ----

// The same 128MB a demo upload allows (serverActions.bodySizeLimit).
const MAX_VIDEO_BYTES = 128 * 1024 * 1024;

/** One clip into the coach's video library. The page sends a batch one file at a time. */
export async function uploadLibraryVideoAction(formData: FormData): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const coach = await requireCoach();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ok: false, error: "Empty file." };
  if (file.size > MAX_VIDEO_BYTES) return { ok: false, error: `${file.name} is ${(file.size / 1024 / 1024).toFixed(0)}MB; the limit is 128MB.` };
  if (!file.type.startsWith("video/")) return { ok: false, error: `${file.name} isn't a video.` };
  const buffer = Buffer.from(await file.arrayBuffer());
  const video = addCoachVideo(coach.id, buffer, file.type, file.name.replace(/\.[a-z0-9]{2,5}$/i, ""));
  if (!video) return { ok: false, error: "Couldn't save it." };
  await putUpload(video.path, buffer, file.type);
  revalidatePath("/admin");
  return { ok: true, id: video.id };
}

/** A video from the library as an exercise's demo (null: the exercise has none). */
export async function assignVideoToExerciseAction(exerciseId: number, videoId: number | null): Promise<boolean> {
  const coach = await requireCoach();
  if (!coachOwnsExercise(coach.id, Number(exerciseId))) return false;
  if (videoId == null) {
    setExerciseVideoUrl(Number(exerciseId), null);
  } else {
    const video = listCoachVideos(coach.id).find((v) => v.id === Number(videoId));
    if (!video) return false;
    setExerciseVideoUrl(Number(exerciseId), video.path);
  }
  revalidatePath("/admin");
  revalidatePath("/client");
  return true;
}

/** Deletes a video from the library; any exercise using it loses its demo. */
/** A clip's name, as the Videos shelf renames it. */
export async function renameLibraryVideoAction(videoId: number, name: string): Promise<boolean> {
  const coach = await requireCoach();
  if (!renameCoachVideo(coach.id, Number(videoId), String(name ?? ""))) return false;
  revalidatePath("/admin");
  return true;
}

export async function deleteLibraryVideoAction(videoId: number): Promise<boolean> {
  const coach = await requireCoach();
  const removed = removeCoachVideo(coach.id, Number(videoId));
  if (!removed) return false;
  await deleteUpload(removed);
  revalidatePath("/admin");
  revalidatePath("/client");
  return true;
}
