"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { clearDemoAction, clearExerciseDemoAction, setDemoUrlAction, setExerciseDemoLinkAction, uploadDemoVideoAction, uploadExerciseVideoAction } from "../lib/actions";
import { TRACK_PALETTE } from "./phaseChrome";

// The demo video for one prescribed exercise.
//
// In the table this is a chip and nothing else — "Add demo" when empty, a
// filled "▶ Demo" once set. Everything else happens in a dialog rendered into
// document.body via a portal, so it is structurally impossible for this
// control to affect the cell it sits in. The previous version revealed a URL
// field inline, which pushed the exercise name into a four-line column and
// wrecked the row it was meant to annotate.
//
// Two ways to attach one, because coaches have both: a link (YouTube, Vimeo,
// a Drive share) or a file straight off their computer. A link costs nothing
// to store and is the common case, so it leads.
//
// Per exercise, not per prescription: set once, the video follows the
// exercise onto every client's sheet until the coach changes it, so a demo
// is never attached twice. A prescription's own older video is kept only as
// a fallback for rows set up before this.
export default function DemoVideoDialog({
  assignmentId = null,
  exerciseId = null,
  clientId = null,
  exerciseName,
  demoUrl,
  libraryUrl,
}: {
  /** A saved row. */
  assignmentId?: number | null;
  /** Or the exercise alone: a row just added, not applied yet. */
  exerciseId?: number | null;
  clientId?: number | null;
  exerciseName: string;
  /** Set on THIS prescription by the coach. */
  demoUrl: string | null;
  /** The exercise library's video, used when the prescription has none. */
  libraryUrl: string | null;
}) {
  // The dialog only ever opens from a click, so it is never in the server
  // render and the portal needs no mount guard.
  const [open, setOpen] = useState(false);

  const effective = libraryUrl || demoUrl;

  return (
    <>
      <button
        type="button"
        className={`pb-demo-chip${effective ? " set" : ""}`}
        onClick={() => setOpen(true)}
        title={
          effective
            ? `Demo video for ${exerciseName}, shown wherever it is prescribed. Click to change it`
            : `Attach a demo video for ${exerciseName}`
        }
      >
        {effective ? "▶ Demo" : "Add demo"}
      </button>

      {open &&
        createPortal(
          <DemoDialog
            assignmentId={assignmentId}
            exerciseId={exerciseId}
            clientId={clientId}
            exerciseName={exerciseName}
            effective={effective}
            onClose={() => setOpen(false)}
          />,
          document.body
        )}
    </>
  );
}

function DemoDialog({
  assignmentId,
  exerciseId,
  clientId,
  exerciseName,
  effective,
  onClose,
}: {
  assignmentId: number | null;
  exerciseId: number | null;
  clientId: number | null;
  exerciseName: string;
  /** What the client sees now: the library video, else an older per-row one. */
  effective: string | null;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"link" | "file">("link");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Escape closes, and focus lands inside the dialog rather than staying on
  // the chip behind it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    cardRef.current?.querySelector<HTMLInputElement>(".pl-dlg-body input")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const run = (fn: () => Promise<string | null | void>) =>
    start(async () => {
      setError(null);
      const message = await fn();
      if (message) setError(message);
      else onClose();
    });

  const palette = TRACK_PALETTE.training;
  const uploaded = !!effective && effective.startsWith("/uploads/");
  // A row just added has no saved prescription yet: the demo goes on the
  // exercise itself, which is where a saved row's upload goes too.
  const byExercise = assignmentId == null && exerciseId != null;
  return (
    // The phase dialog's chrome: the name and its tags on top, the choice in
    // the body, Remove on the left of the foot and Save on the right.
    <div className="pl-dlg-scrim" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pl-dlg" role="dialog" aria-modal="true" aria-label={`Demo video for ${exerciseName}`} ref={cardRef}>
        <header className="pl-dlg-head">
          <h2>{exerciseName}</h2>
          <span className="pl-track-tag" style={{ background: palette.tint, color: palette.ink }}>
            Demo video
          </span>
          <span className="pl-dlg-state" style={effective ? { background: palette.ink, color: "#fff" } : { background: "#eef0f3", color: "#5b6474" }}>
            {effective ? "Attached" : "None yet"}
          </span>
        </header>

        <form
          className="pl-dlg-form"
          action={(fd) =>
            run(() =>
              byExercise
                ? tab === "link"
                  ? setExerciseDemoLinkAction(fd)
                  : uploadExerciseVideoAction(fd)
                : tab === "link"
                  ? setDemoUrlAction(fd)
                  : uploadDemoVideoAction(fd)
            )
          }
        >
          {byExercise ? (
            <input type="hidden" name="exerciseId" value={exerciseId!} />
          ) : (
            <>
              <input type="hidden" name="assignmentId" value={assignmentId ?? ""} />
              <input type="hidden" name="clientId" value={clientId ?? ""} />
            </>
          )}
          <div className="pl-dlg-body">
            {/* What the client sees right now, stated plainly — including when
                it comes from the library rather than from this prescription. */}
            <div className="pl-dlg-field">
              <span className="pl-dlg-label">The client sees</span>
              {effective ? (
                <a href={effective} target="_blank" rel="noreferrer" className="dv-current">
                  <span>{uploaded ? "An uploaded video" : effective}</span>
                  <small>On every client&rsquo;s sheet that has {exerciseName}</small>
                </a>
              ) : (
                <p className="dv-none">Nothing yet. A demo shows on every client&rsquo;s sheet that has {exerciseName}.</p>
              )}
            </div>

            <div className="pl-dlg-field">
              <span className="pl-dlg-label">{effective ? "Replace it with" : "Attach"}</span>
              <div className="pl-chips" role="group" aria-label="How to attach">
                {(["link", "file"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`pl-chip${tab === t ? " active" : ""}`}
                    style={tab === t ? { background: palette.tint, color: palette.ink, borderColor: palette.ink } : undefined}
                    onClick={() => {
                      setTab(t);
                      setError(null);
                    }}
                    aria-pressed={tab === t}
                  >
                    {t === "link" ? "Paste a link" : "Upload a file"}
                  </button>
                ))}
              </div>
            </div>

            {tab === "link" ? (
              <label className="pl-dlg-field">
                <span className="pl-dlg-label">Link</span>
                <input
                  key="link"
                  name="demoUrl"
                  type="url"
                  className="pl-dlg-input"
                  defaultValue={effective && !uploaded ? effective : ""}
                  placeholder="https://youtube.com/watch?v=…"
                  aria-label={`Demo video link for ${exerciseName}`}
                  required
                />
                <small className="dv-hint">YouTube, Vimeo, or any link that opens a video. The client taps &ldquo;how to&rdquo; to open it.</small>
              </label>
            ) : (
              <div className="pl-dlg-field">
                <span className="pl-dlg-label">Video file</span>
                <label className={`dv-file${fileName ? " chosen" : ""}`}>
                  <input key="file" name="file" type="file" accept="video/*" required onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)} />
                  <span>{fileName ?? "Choose a video from your computer"}</span>
                </label>
                <small className="dv-hint">Up to 64 MB. A phone clip of the movement is plenty; trim it rather than sending a whole session.</small>
              </div>
            )}

            {/* A failed save must say so. Closing on failure would look like
                it worked until the coach reopened the chip. */}
            {error && <p className="pl-move-note warn">{error}</p>}
          </div>

          <footer className="pl-dlg-foot">
            {effective && (
              <button
                type="submit"
                className="pl-text-btn danger"
                formAction={(fd) => run(() => (byExercise ? clearExerciseDemoAction(fd) : clearDemoAction(fd)))}
                formNoValidate
                disabled={pending}
              >
                Remove
              </button>
            )}
            <div className="pl-dlg-actions">
              <button type="button" className="pl-dlg-cancel" onClick={onClose} disabled={pending}>
                Cancel
              </button>
              <button type="submit" className="pl-dlg-save" disabled={pending}>
                {pending ? (tab === "link" ? "Saving…" : "Uploading…") : tab === "link" ? "Save link" : "Upload"}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}
