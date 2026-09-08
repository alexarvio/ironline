"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { clearDemoAction, setDemoUrlAction, uploadDemoVideoAction } from "../lib/actions";

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
  assignmentId,
  clientId,
  exerciseName,
  demoUrl,
  libraryUrl,
}: {
  assignmentId: number;
  clientId: number;
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
  clientId,
  exerciseName,
  effective,
  onClose,
}: {
  assignmentId: number;
  clientId: number;
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
    cardRef.current?.querySelector("input")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const run = (fn: () => Promise<string | null>) =>
    start(async () => {
      setError(null);
      const message = await fn();
      if (message) setError(message);
      else onClose();
    });

  return (
    <div className="pb-modal-scrim" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pb-modal" role="dialog" aria-modal="true" aria-label={`Demo video for ${exerciseName}`} ref={cardRef}>
        <div className="pb-modal-head">
          <div>
            <span className="ad-microlabel">Demo video</span>
            <h2 className="pb-modal-title">{exerciseName}</h2>
          </div>
          <button type="button" className="pb-modal-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {/* What the client sees right now, stated plainly — including when it
            comes from the library rather than from this prescription. */}
        <div className="pb-demo-current">
          {effective ? (
            <>
              <span className="pb-demo-current-label">Client sees</span>
              <a href={effective} target="_blank" rel="noreferrer" className="pb-demo-current-link">
                {effective.startsWith("/uploads/") ? "Uploaded file" : effective}
              </a>
              <span className="pb-demo-fallback">on every client&rsquo;s sheet that has {exerciseName}</span>
              <form action={clearDemoAction}>
                <input type="hidden" name="assignmentId" value={assignmentId} />
                <button type="submit" className="pb-demo-remove">
                  Remove
                </button>
              </form>
            </>
          ) : (
            <span className="pb-demo-current-label">Nothing attached yet.</span>
          )}
        </div>

        <div className="pb-demo-tabs" role="group" aria-label="How to attach">
          {(["link", "file"] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={`pb-demo-tab${tab === t ? " on" : ""}`}
              onClick={() => setTab(t)}
              aria-pressed={tab === t}
            >
              {t === "link" ? "Paste a link" : "Upload a file"}
            </button>
          ))}
        </div>

        {tab === "link" ? (
          <form
            action={(fd) => run(() => setDemoUrlAction(fd))}
            className="pb-demo-pane"
          >
            <input type="hidden" name="assignmentId" value={assignmentId} />
            <input
              name="demoUrl"
              type="url"
              defaultValue={effective && !effective.startsWith("/uploads/") ? effective : ""}
              placeholder="https://youtube.com/watch?v=…"
              aria-label={`Demo video link for ${exerciseName}`}
              className="pb-demo-input"
              required
            />
            <p className="pb-demo-hint">
              YouTube, Vimeo, or any link that opens a video. The client taps “how to” to open it.
            </p>
            <div className="pb-modal-foot">
              <button type="button" className="ad-btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="ad-btn-primary" disabled={pending}>
                {pending ? "Saving…" : "Save link"}
              </button>
            </div>
          </form>
        ) : (
          <form
            action={(fd) => run(() => uploadDemoVideoAction(fd))}
            className="pb-demo-pane"
          >
            <input type="hidden" name="assignmentId" value={assignmentId} />
            <input type="hidden" name="clientId" value={clientId} />
            <label className="pb-demo-file">
              <input
                name="file"
                type="file"
                accept="video/*"
                required
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
              />
              <span>{fileName ?? "Choose a video from your computer"}</span>
            </label>
            <p className="pb-demo-hint">
              Up to 64&nbsp;MB. A phone clip of the movement is usually plenty. Trim it before uploading
              rather than sending a whole session.
            </p>
            <div className="pb-modal-foot">
              <button type="button" className="ad-btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="ad-btn-primary" disabled={pending}>
                {pending ? "Uploading…" : "Upload"}
              </button>
            </div>
          </form>
        )}

        {/* A failed upload must say so. Closing on failure would look like it
            worked until the coach reopened the chip. */}
        {error && <p className="pb-demo-error">{error}</p>}
      </div>
    </div>
  );
}
