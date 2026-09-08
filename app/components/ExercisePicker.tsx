"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { addExerciseToLibraryAction, uploadExerciseVideoAction } from "../lib/actions";

type Group = { slug: string; label: string };
type ExerciseOption = { id: number; name: string };
// A video waiting to be attached to the exercise being created: a link, or
// a file that is uploaded once the exercise exists and has an id.
type PendingVideo = { kind: "link"; url: string } | { kind: "file"; file: File };

// The "Add exercise…" picker on a programme day. The popup opens on a search
// box: type and matching exercises from the whole library list at once.
// With nothing typed, the six groups sit under it as tiles; a tile opens
// that group's list. At the foot, whichever view is showing, there is a way
// to add a new exercise: a name, a group, an optional demo video attached
// the same way as on a prescription (paste a link or upload a file), and
// Save, which puts it in the library and picks it for this row in one go.
// The video belongs to the exercise, so it follows it onto every client.
export default function ExercisePicker({
  formId,
  groups,
  exercisesByGroup,
}: {
  formId: string;
  groups: readonly Group[];
  exercisesByGroup: Record<string, ExerciseOption[]>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedName, setSelectedName] = useState<string>("");
  const [addingNew, setAddingNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [video, setVideo] = useState<PendingVideo | null>(null);
  const [videoDialog, setVideoDialog] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const pick = (ex: ExerciseOption) => {
    setSelectedId(ex.id);
    setSelectedName(ex.name);
    setOpen(false);
    setActiveGroup(null);
    setAddingNew(false);
    setQuery("");
    setVideo(null);
  };

  const toggleOpen = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen((o) => !o);
  };

  const q = query.trim().toLowerCase();
  const matches = q
    ? groups.flatMap((g) =>
        (exercisesByGroup[g.slug] ?? [])
          .filter((ex) => ex.name.toLowerCase().includes(q))
          .map((ex) => ({ ...ex, groupLabel: g.label }))
      )
    : [];

  // Group preselected for a new exercise: the one being browsed, else the
  // first group. Not "other": every group is a real choice on the form.
  const defaultGroup = activeGroup ?? groups[0]?.slug ?? "other";

  const saveNew = async (formData: FormData) => {
    setSaving(true);
    setSaveError(null);
    if (video?.kind === "link") formData.set("videoUrl", video.url);
    const created = await addExerciseToLibraryAction(formData);
    if (created && video?.kind === "file") {
      const fd = new FormData();
      fd.set("exerciseId", String(created.id));
      fd.set("file", video.file);
      const message = await uploadExerciseVideoAction(fd);
      if (message) {
        // The exercise exists and is picked; only the clip failed. Say so and
        // leave the coach on the row, where the demo chip can retry it.
        setSaveError(`Saved ${created.name}, but the video didn't upload: ${message}`);
      }
    }
    setSaving(false);
    if (created) pick(created);
  };

  return (
    <div className="exercise-picker">
      <input type="hidden" name="exerciseId" form={formId} value={selectedId ?? ""} />
      <button ref={triggerRef} type="button" className="exercise-picker-trigger" onClick={toggleOpen}>
        {selectedName || "Add exercise…"}
      </button>
      {saveError && !open && <div className="pb-demo-error">{saveError}</div>}

      {open && (
        <>
          <div className="exercise-picker-backdrop" onClick={() => setOpen(false)} />
          <div className="exercise-picker-pop" style={pos ? { top: pos.top, left: pos.left } : undefined}>
            <input
              ref={searchRef}
              type="search"
              className="exercise-picker-search"
              placeholder="Search exercises"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveGroup(null);
              }}
              aria-label="Search exercises"
            />

            {q ? (
              <div className="exercise-picker-list">
                {matches.length === 0 && (
                  <div className="empty-note" style={{ padding: "6px 4px" }}>
                    Nothing called &ldquo;{query.trim()}&rdquo; yet. Add it below.
                  </div>
                )}
                {matches.map((ex) => (
                  <button key={ex.id} type="button" className="exercise-picker-item" onClick={() => pick(ex)}>
                    {ex.name}
                    <span className="exercise-meta">{ex.groupLabel}</span>
                  </button>
                ))}
              </div>
            ) : !activeGroup ? (
              <div className="exercise-picker-groups">
                {groups.map((g) => (
                  <button
                    key={g.slug}
                    type="button"
                    className="exercise-picker-group-btn"
                    onClick={() => setActiveGroup(g.slug)}
                  >
                    {g.label}
                    <span className="exercise-meta">{exercisesByGroup[g.slug]?.length ?? 0}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div>
                <div className="exercise-picker-header">
                  <button type="button" className="exercise-picker-back" onClick={() => setActiveGroup(null)}>
                    ‹ back
                  </button>
                  <span>{groups.find((g) => g.slug === activeGroup)?.label}</span>
                </div>
                <div className="exercise-picker-list">
                  {(exercisesByGroup[activeGroup] ?? []).length === 0 && (
                    <div className="empty-note" style={{ padding: "6px 4px" }}>
                      No exercises yet in this group.
                    </div>
                  )}
                  {(exercisesByGroup[activeGroup] ?? []).map((ex) => (
                    <button key={ex.id} type="button" className="exercise-picker-item" onClick={() => pick(ex)}>
                      {ex.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="exercise-picker-foot">
              {addingNew ? (
                <form className="exercise-picker-add-form" action={saveNew}>
                  <input
                    name="name"
                    type="text"
                    placeholder="Exercise name"
                    defaultValue={q ? query.trim() : ""}
                    required
                    autoFocus
                    aria-label="New exercise name"
                  />
                  <select name="muscleGroup" defaultValue={defaultGroup} aria-label="Muscle group">
                    {groups.map((g) => (
                      <option key={g.slug} value={g.slug}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                  <div className="exercise-picker-video">
                    <button
                      type="button"
                      className={`pb-demo-chip${video ? " set" : ""}`}
                      onClick={() => setVideoDialog(true)}
                    >
                      {video ? "▶ Demo" : "Add demo"}
                    </button>
                    {video && (
                      <span className="exercise-picker-video-name">
                        {video.kind === "link" ? video.url : video.file.name}
                      </span>
                    )}
                  </div>
                  {saveError && <div className="pb-demo-error">{saveError}</div>}
                  <div className="exercise-picker-add-actions">
                    <button
                      type="button"
                      className="btn secondary btn-sm"
                      onClick={() => {
                        setAddingNew(false);
                        setVideo(null);
                      }}
                      disabled={saving}
                    >
                      Cancel
                    </button>
                    <button className="btn btn-sm" type="submit" disabled={saving}>
                      {saving ? "Saving…" : "Save to library"}
                    </button>
                  </div>
                </form>
              ) : (
                <button type="button" className="exercise-picker-add-toggle" onClick={() => setAddingNew(true)}>
                  + Add new exercise
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {videoDialog &&
        createPortal(
          <PendingVideoDialog
            current={video}
            onChoose={(v) => {
              setVideo(v);
              setVideoDialog(false);
            }}
            onClose={() => setVideoDialog(false)}
          />,
          document.body
        )}
    </div>
  );
}

// Same dialog as a prescription's demo, but nothing is saved here: the
// choice is held until the exercise is created, then attached to it.
function PendingVideoDialog({
  current,
  onChoose,
  onClose,
}: {
  current: PendingVideo | null;
  onChoose: (v: PendingVideo | null) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"link" | "file">(current?.kind === "file" ? "file" : "link");
  const [url, setUrl] = useState(current?.kind === "link" ? current.url : "");
  const [file, setFile] = useState<File | null>(current?.kind === "file" ? current.file : null);
  const [error, setError] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    cardRef.current?.querySelector("input")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="pb-modal-scrim" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pb-modal" role="dialog" aria-modal="true" aria-label="Demo video for the new exercise" ref={cardRef}>
        <div className="pb-modal-head">
          <div>
            <span className="ad-microlabel">Demo video</span>
            <h2 className="pb-modal-title">New exercise</h2>
          </div>
          <button type="button" className="pb-modal-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="pb-demo-current">
          <span className="pb-demo-current-label">
            Attached to the exercise itself, so every client you give it to sees the same demo.
          </span>
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
          <div className="pb-demo-pane">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=…"
              aria-label="Demo video link"
              className="pb-demo-input"
            />
            <p className="pb-demo-hint">YouTube, Vimeo, or any link that opens a video. The client taps “how to” to open it.</p>
            <div className="pb-modal-foot">
              {current && (
                <button type="button" className="pb-demo-remove" onClick={() => onChoose(null)}>
                  Remove
                </button>
              )}
              <button type="button" className="ad-btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="ad-btn-primary"
                onClick={() => {
                  const u = url.trim();
                  if (!u) return setError("Paste a link first.");
                  if (!/^https?:\/\//i.test(u)) return setError("That needs to start with http:// or https://");
                  onChoose({ kind: "link", url: u });
                }}
              >
                Use link
              </button>
            </div>
          </div>
        ) : (
          <div className="pb-demo-pane">
            <label className="pb-demo-file">
              <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <span>{file?.name ?? "Choose a video from your computer"}</span>
            </label>
            <p className="pb-demo-hint">
              Up to 64&nbsp;MB. A phone clip of the movement is usually plenty. It uploads when you save the exercise.
            </p>
            <div className="pb-modal-foot">
              {current && (
                <button type="button" className="pb-demo-remove" onClick={() => onChoose(null)}>
                  Remove
                </button>
              )}
              <button type="button" className="ad-btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="ad-btn-primary"
                onClick={() => {
                  if (!file) return setError("Choose a file first.");
                  if (!file.type.startsWith("video/")) return setError("That doesn't look like a video file.");
                  onChoose({ kind: "file", file });
                }}
              >
                Use file
              </button>
            </div>
          </div>
        )}

        {error && <p className="pb-demo-error">{error}</p>}
      </div>
    </div>
  );
}
