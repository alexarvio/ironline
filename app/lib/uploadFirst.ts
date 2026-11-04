// The browser's half of the one way in for big files (4 Nov, Alex: memory; lib/streamUpload.ts, app/api/upload). A
// form's "file" goes first as the raw body to /api/upload, which writes it to the server's disk as it arrives; the
// form then carries the handle it answers with ("upload") in its place, and the server action files that. No server
// imports here: the chat composers, the exercise and demo uploads and the photo screens all call it.

/** What the upload is for (streamUpload.ts's UploadKind). */
export type UploadKind = "video" | "photo" | "media" | "chat";

/**
 * Sends the form's "file" ahead and swaps it for its handle, in place. Back with null when the form is ready for its
 * action (a form with no file is left as it was), or with the server's words when it refused the file (too big, not a
 * video). A dropped connection or a server error throws, as a failed action call did, so each caller's own catch says
 * it as before. `clientId` is the client it is for (a chat, a photo); a client's own comes from their sign-in.
 */
export async function uploadFirst(fd: FormData, kind: UploadKind, clientId?: number | null): Promise<string | null> {
  const file = fd.get("file");
  if (!(file instanceof Blob)) return null;
  // An empty one never goes: the action then says "Choose a file first", as before.
  if (file.size === 0) {
    fd.delete("file");
    return null;
  }
  const name = file instanceof File ? file.name : "";
  const q = new URLSearchParams({ kind, type: file.type, name });
  if (clientId != null && Number.isFinite(clientId)) q.set("clientId", String(clientId));
  await freshSignIn();
  const res = await fetch(`/api/upload?${q}`, {
    method: "POST",
    body: file,
    headers: { "content-type": file.type || "application/octet-stream" },
    credentials: "same-origin",
  });
  let answer: { handle?: string; error?: string } = {};
  try {
    answer = await res.json();
  } catch {
    /* not JSON: a proxy's or server's error page */
  }
  if (res.ok && answer.handle) {
    // The file leaves the form only once the server has it (4 Nov, review): a failed upload leaves the form as it was.
    fd.delete("file");
    fd.set("upload", answer.handle);
    return null;
  }
  // Refused in words (413 too big, 415 not a video): those words. Anything else is a failure like any other.
  if ((res.status === 413 || res.status === 415) && answer.error) return answer.error;
  throw new Error(answer.error || `Upload failed (${res.status})`);
}

/**
 * With Clerk on, the sign-in is a short-lived cookie its script renews. /api/upload is outside proxy.ts and reads the
 * cookie as it comes (4 Nov, review: a phone back from the photo picker, its page asleep meanwhile, could send one a
 * few seconds stale and be refused). So the cookie is renewed first when it needs to be (cached when still good). Never waits more than 3 s, never throws; without Clerk it
 * does nothing.
 */
async function freshSignIn() {
  const clerk = (globalThis as unknown as { Clerk?: { session?: { getToken?: () => Promise<unknown> } | null } }).Clerk;
  const getToken = clerk?.session?.getToken;
  if (typeof getToken !== "function") return;
  try {
    await Promise.race([getToken.call(clerk!.session), new Promise((resolve) => setTimeout(resolve, 3000))]);
  } catch {
    /* the upload says so if the sign-in is really gone */
  }
}

/** uploadFirst, throwing its words instead (for a send whose failure is caught as one). */
export async function uploadFirstOrThrow(fd: FormData, kind: UploadKind, clientId?: number | null): Promise<FormData> {
  const error = await uploadFirst(fd, kind, clientId);
  if (error) throw new Error(error);
  return fd;
}
