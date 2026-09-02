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
// Per prescription, not per exercise: the same lift can carry a different cue
// in a different block. The library's own video is the fallback and is shown
// as such — never silently copied onto the prescription, which is what the
// old save-on-blur did the moment the field was focused.
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
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const effective = demoUrl || libraryUrl;

  return (
    <>
      <button
        type="button"
        className={`pb-demo-chip${effective ? " set" : ""}`}
        onClick={() => setOpen(true)}
        title={
          demoUrl
            ? `Demo for this prescription: ${demoUrl}`
            : libraryUrl
            ? "Using the exercise library's video — click to set one for this prescription"
            : `Attach a demo video for ${exerciseName}`
        }
      >
        {effective ? "▶ Demo" : "Add demo"}
      </button>

      {open && mounted &&
        createPortal(
          <DemoDialog
            assignmentId={assignmentId}
            clientId={clientId}
            exerciseName={exerciseName}
            demoUrl={demoUrl}
            libraryUrl={libraryUrl}
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
  demoUrl,
  libraryUrl,
  onClose,
}: {
  assignmentId: number;
  clientId: number;
  exerciseName: string;
  demoUrl: string | null;
  libraryUrl: string | null;
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

  const uploaded = demoUrl?.startsWith("/uploads/") ?? false;

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
          {demoUrl ? (
            <>
              <span className="pb-demo-current-label">Client sees</span>
              <a href={demoUrl} target="_blank" rel="noreferrer" className="pb-demo-current-link">
                {uploaded ? "Uploaded file" : demoUrl}
              </a>
              <form action={clearDemoAction}>
                <input type="hidden" name="assignmentId" value={assignmentId} />
                <button type="submit" className="pb-demo-remove">
                  Remove
                </button>
              </form>
            </>
          ) : libraryUrl ? (
            <>
              <span className="pb-demo-current-label">Client sees</span>
              <a href={libraryUrl} target="_blank" rel="noreferrer" className="pb-demo-current-link">
                {libraryUrl}
              </a>
              <span className="pb-demo-fallback">from the exercise library</span>
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
              defaultValue={uploaded ? "" : demoUrl ?? ""}
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
              Up to 64&nbsp;MB. A phone clip of the movement is usually plenty — trim it before uploading
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
