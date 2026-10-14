"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";
import { CheckIcon, ChevronLeftIcon, PlayIcon, PlusIcon, SearchIcon, TrashIcon } from "../../../components/icons";
import { clearExerciseDemoAction, setExerciseDemoLinkAction } from "../../../lib/actions";
import { groupColour } from "../../../lib/muscleGroups";
import { assignVideoToExerciseAction, createLibraryExerciseAction, saveExerciseSubstitutesAction, saveExerciseVariationsAction, updateLibraryExerciseAction, uploadLibraryVideoAction } from "./actions";
import type { LibraryItem, LibraryVideo } from "./load";
import { useAutosave } from "./useAutosave";

// The exercise editor (14 Oct, "all on one page"): what opens when a coach
// clicks an exercise in the Library. The New phase and New event dialogs'
// language: a white modal, the group's colour on the title pill and a glow,
// tinted tiles, soft grey panels, one navy Done. Everything saves as it is
// set (useAutosave); there is no Save.
//
// Left, the demo: the video or link it has (or a drop zone), a link field,
// and the coach's videos to set as the demo in one click. Right: the name,
// the muscle group as tiles, the default cue, the variations as rows (demo,
// name, cue or link) and the substitutes, ranked 1 to 3, found by a search
// that suggests the same group first.

type Var = { id: number; name: string; video: string | null; cue: string };
type Sub = { exerciseId: number; name: string; note: string };

const MAX_SUBS = 12;
const ytId = (url: string) => /(?:youtu\.be\/|[?&]v=|shorts\/|embed\/)([\w-]{11})/.exec(url)?.[1] ?? null;
const isUpload = (url: string) => url.startsWith("/uploads/") || /\.(mp4|mov|m4v|webm)(\?|$)/i.test(url);
const isUrl = (s: string) => /^https?:\/\/\S+\.\S+/i.test(s.trim());
const providerOf = (url: string) => (/youtu\.?be/i.test(url) ? "YouTube" : /vimeo/i.test(url) ? "Vimeo" : "Link");
const fmtDuration = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
const fileName = (path: string) => decodeURIComponent(path.split("?")[0].split("/").pop() ?? "video");

/** A poster for a demo: the clip's first frame, YouTube's thumbnail, or the gradient. */
function Poster({ url, large, onDuration }: { url: string | null; large?: boolean; onDuration?: (s: number) => void }) {
  if (!url) return <span className={`exm-poster${large ? " large" : ""}`} aria-hidden="true" />;
  const id = ytId(url);
  if (id)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- YouTube's own thumbnail
      <img className={`exm-poster${large ? " large" : ""}`} src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" draggable={false} />
    );
  if (isUpload(url))
    return <video className={`exm-poster${large ? " large" : ""}`} src={`${url}#t=0.5`} preload="metadata" muted playsInline draggable={false} onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && onDuration?.(e.currentTarget.duration)} />;
  return <span className={`exm-poster${large ? " large" : ""}`} aria-hidden="true" />;
}

export default function ExerciseEditorModal({
  item,
  items,
  videos,
  groups,
  onClose,
  onOpenOther,
  onChanged,
  backTo,
}: {
  item: LibraryItem;
  items: LibraryItem[];
  videos: LibraryVideo[];
  groups: { slug: string; label: string }[];
  onClose: () => void;
  /** A substitute's name: that exercise's editor, with a way back to this one. */
  onOpenOther: (id: number) => void;
  /** The page re-reads the library (the list behind, the videos). */
  onChanged: () => void;
  /** The exercise this one was opened from, for "← Back to …". */
  backTo?: { id: number; name: string } | null;
}) {
  const save = useAutosave();
  // ---- Local copies, the source of truth while the editor is open; the page's copy only hands back ids.
  const [name, setName] = useState(item.name);
  const [savedName, setSavedName] = useState(item.name);
  const [nameHint, setNameHint] = useState<string | null>(null);
  const [group, setGroup] = useState(item.group);
  const [cue, setCue] = useState(item.cue);
  const [demo, setDemo] = useState<string | null>(item.video);
  const [link, setLink] = useState(item.video && !isUpload(item.video) ? item.video : "");
  const [linkBad, setLinkBad] = useState(false);
  const [vars, setVars] = useState<Var[]>(item.variations);
  const [subs, setSubs] = useState<Sub[]>(item.substitutes);
  const [uploading, setUploading] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [allVideos, setAllVideos] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const varFileInput = useRef<HTMLInputElement>(null);
  const varFileFor = useRef<number | null>(null);

  // The server gives a new variation its id: adopt it by position once the page comes back.
  const varsRef = useRef(vars);
  useEffect(() => {
    varsRef.current = vars;
  }, [vars]);
  useEffect(() => {
    const mine = varsRef.current;
    if (mine.some((v) => v.id < 0) && item.variations.length === mine.length) {
      const t = setTimeout(() => setVars(mine.map((v, i) => (v.id < 0 ? { ...v, id: item.variations[i].id } : v))), 0);
      return () => clearTimeout(t);
    }
  }, [item.variations]);

  const gc = groupColour(group);
  const used = item.clients;
  const others = useMemo(() => items.filter((x) => x.id !== item.id && !x.archived), [items, item.id]);

  // ---- Saves.
  const patch = (p: { name?: string; group?: string; cue?: string | null }) => () => updateLibraryExerciseAction(item.id, p);
  const saveName = () => {
    const n = name.trim();
    if (!n) {
      setName(savedName);
      setNameHint("An exercise needs a name");
      return;
    }
    if (others.some((x) => x.name.trim().toLowerCase() === n.toLowerCase())) {
      setNameHint(`${n} already exists`);
      return;
    }
    setNameHint(null);
    if (n === savedName) return;
    setSavedName(n);
    save.now("name", patch({ name: n }));
  };
  const pickGroup = (slug: string) => {
    setGroup(slug);
    void save.run(patch({ group: slug }));
  };
  const saveVars = (next: Var[]) => {
    setVars(next);
    void save.run(() => saveExerciseVariationsAction(item.id, next.map((v) => ({ id: v.id < 0 ? null : v.id, name: v.name, video: v.video, cue: v.cue }))).then(onChanged));
  };
  const saveVarsLater = (next: Var[]) => {
    setVars(next);
    save.later("vars", () => saveExerciseVariationsAction(item.id, next.map((v) => ({ id: v.id < 0 ? null : v.id, name: v.name, video: v.video, cue: v.cue }))).then(onChanged));
  };
  const saveSubs = (next: Sub[], later = false) => {
    setSubs(next);
    const job = () => saveExerciseSubstitutesAction(item.id, next.map((s) => ({ exerciseId: s.exerciseId, note: s.note })));
    if (later) save.later("subs", job);
    else void save.run(job);
  };
  const setDemoVideo = (videoId: number, path: string) => {
    setDemo(path);
    setPlaying(false);
    void save.run(() => assignVideoToExerciseAction(item.id, videoId).then(onChanged));
  };
  const removeDemo = () => {
    setDemo(null);
    setPlaying(false);
    void save.run(() => {
      const f = new FormData();
      f.set("exerciseId", String(item.id));
      return clearExerciseDemoAction(f).then(onChanged);
    });
  };
  const useLink = () => {
    const u = link.trim();
    if (!u) {
      setLinkBad(false);
      if (demo && !isUpload(demo)) removeDemo();
      return;
    }
    if (!isUrl(u)) {
      setLinkBad(true);
      return;
    }
    setLinkBad(false);
    if (u === demo) return;
    setDemo(u);
    setPlaying(false);
    void save.run(async () => {
      const f = new FormData();
      f.set("exerciseId", String(item.id));
      f.set("demoUrl", u);
      const err = await setExerciseDemoLinkAction(f);
      if (err) throw new Error(err);
      onChanged();
    });
  };
  const upload = async (file: File | undefined, forVar: number | null = null) => {
    if (!file || uploading) return;
    if (!file.type.startsWith("video/")) {
      toast.error("That isn't a video.");
      return;
    }
    setUploading(file.name);
    const f = new FormData();
    f.set("file", file);
    const r = await uploadLibraryVideoAction(f).catch(() => ({ ok: false as const, error: `${file.name} didn't upload.` }));
    setUploading(null);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    // The upload's path: the page's videos list has it after the refresh; until then, the slot shows the name.
    onChanged();
    if (forVar == null) {
      void save.run(() => assignVideoToExerciseAction(item.id, r.id));
      setDemo(`/uploads/pending/${r.id}`);
      setPendingUpload({ id: r.id, name: file.name });
    } else {
      setPendingVarUpload({ varId: forVar, videoId: r.id, name: file.name });
    }
  };
  // An upload just made, before the page hands its path back: the preview shows its name.
  const [pendingUpload, setPendingUpload] = useState<{ id: number; name: string } | null>(null);
  const [pendingVarUpload, setPendingVarUpload] = useState<{ varId: number; videoId: number; name: string } | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      if (pendingUpload) {
        const v = videos.find((x) => x.id === pendingUpload.id);
        if (v) {
          setDemo(v.path);
          setPendingUpload(null);
        }
      }
      if (pendingVarUpload) {
        const v = videos.find((x) => x.id === pendingVarUpload.videoId);
        if (v) {
          const next = varsRef.current.map((x) => (x.id === pendingVarUpload.varId ? { ...x, video: v.path } : x));
          setPendingVarUpload(null);
          saveVars(next);
        }
      }
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the videos list arriving is the trigger
  }, [videos]);

  // ---- Done: everything waiting goes first; a failure keeps the editor open.
  const [closing, setClosing] = useState(false);
  const done = async () => {
    if (closing) return;
    setClosing(true);
    const ok = await save.flush();
    setClosing(false);
    if (ok) onClose();
  };

  // ---- Variations.
  const addVariation = () => {
    const id = -Date.now();
    setVars((l) => [...l, { id, name: "", video: null, cue: "" }]);
    setTimeout(() => document.querySelector<HTMLInputElement>(`[data-var-name="${id}"]`)?.focus(), 0);
  };
  const removeVariation = (v: Var) => {
    const at = vars.findIndex((x) => x.id === v.id);
    saveVars(vars.filter((x) => x.id !== v.id));
    if (!v.name && !v.video && !v.cue) return;
    toast("Variation removed", {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => {
          const back = [...varsRef.current];
          back.splice(Math.min(at, back.length), 0, { ...v, id: -Date.now() });
          saveVars(back);
        },
      },
    });
  };
  const moveVar = (from: number, to: number) => {
    if (to < 0 || to >= vars.length || from === to) return;
    const next = [...vars];
    const [v] = next.splice(from, 1);
    next.splice(to, 0, v);
    saveVars(next);
  };
  const [varMenu, setVarMenu] = useState<number | null>(null);
  const [varLinkFor, setVarLinkFor] = useState<number | null>(null);
  const [varLink, setVarLink] = useState("");
  const dragVar = useRef<number | null>(null);

  // ---- Substitutes.
  const [q, setQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchWrap = useRef<HTMLDivElement>(null);
  const candidates = useMemo(() => {
    const taken = new Set(subs.map((s) => s.exerciseId));
    const pool = others.filter((x) => !taken.has(x.id));
    const needle = q.trim().toLowerCase();
    const demoFirst = (a: LibraryItem, b: LibraryItem) => Number(!!b.video) - Number(!!a.video) || a.name.localeCompare(b.name);
    if (!needle) return pool.filter((x) => x.group === group).sort(demoFirst).slice(0, 5);
    const hits = pool.filter((x) => x.name.toLowerCase().includes(needle));
    return [...hits.filter((x) => x.group === group).sort(demoFirst), ...hits.filter((x) => x.group !== group).sort(demoFirst)].slice(0, 8);
  }, [others, subs, q, group]);
  useEffect(() => {
    if (!searchOpen) return;
    const t = setTimeout(() => searchWrap.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 30);
    return () => clearTimeout(t);
  }, [searchOpen, q]);
  const addSub = (x: LibraryItem) => {
    if (subs.length >= MAX_SUBS) return;
    saveSubs([...subs, { exerciseId: x.id, name: x.name, note: "" }]);
    setQ("");
    setCursor(0);
    if (subs.length + 1 >= MAX_SUBS) setSearchOpen(false);
    else searchRef.current?.focus();
  };
  const removeSub = (s: Sub) => {
    const at = subs.findIndex((x) => x.exerciseId === s.exerciseId);
    saveSubs(subs.filter((x) => x.exerciseId !== s.exerciseId));
    toast(`${s.name} removed`, {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => {
          const back = [...subsRef.current];
          if (back.length >= MAX_SUBS || back.some((x) => x.exerciseId === s.exerciseId)) return;
          back.splice(Math.min(at, back.length), 0, s);
          saveSubs(back);
        },
      },
    });
  };
  const subsRef = useRef(subs);
  useEffect(() => {
    subsRef.current = subs;
  }, [subs]);
  const moveSub = (from: number, to: number) => {
    if (to < 0 || to >= subs.length || from === to) return;
    const next = [...subs];
    const [s] = next.splice(from, 1);
    next.splice(to, 0, s);
    saveSubs(next);
  };
  const dragSub = useRef<number | null>(null);
  const [creating, setCreating] = useState(false);
  const createAndAdd = async () => {
    const n = q.trim();
    if (!n || creating) return;
    setCreating(true);
    const id = await createLibraryExerciseAction(n, group, "");
    setCreating(false);
    if (id == null) {
      toast.error("Couldn't add it.");
      return;
    }
    onChanged();
    addSub({ id, name: n, group, video: null, cue: "", clients: 0, archived: false, variations: [], substitutes: [] });
  };

  // ---- Your videos: the unused first, then the ones on this exercise, then the rest; six, or all.
  const shownVideos = useMemo(() => {
    const rank = (v: LibraryVideo) => (v.usedBy.length === 0 ? 0 : v.usedBy.some((u) => u.id === item.id) ? 1 : 2);
    const sorted = [...videos].sort((a, b) => rank(a) - rank(b) || b.at.localeCompare(a.at));
    return allVideos ? sorted : sorted.slice(0, 6);
  }, [videos, allVideos, item.id]);
  const [demoSeconds, setDemoSeconds] = useState<number | null>(null);

  const byId = (id: number) => items.find((x) => x.id === id) ?? null;
  // Variations and substitutes share one place, a tab each (14 Oct, Alex): both open ran the dialog out of room.
  const [tab, setTab] = useState<"variations" | "substitutes">("variations");
  const sectionLabel = (text: string) => <span className="exm-label">{text}</span>;

  return (
    <Dialog open onOpenChange={(o) => !o && void done()}>
      <DialogContent className="exm" style={{ "--g": gc.color, "--g-rgb": gc.rgb } as React.CSSProperties} aria-describedby={undefined}>
        <span className="exm-glow" aria-hidden="true" />
        {/* ---- Header */}
        <header className="exm-head">
          <div className="exm-head-text">
            {backTo && (
              <button type="button" className="exm-back" onClick={() => onOpenOther(backTo.id)}>
                <ChevronLeftIcon /> Back to {backTo.name}
              </button>
            )}
            <div className="exm-title-row">
              <DialogTitle className="exm-title">{name.trim() || "Untitled exercise"}</DialogTitle>
              <span className="exm-pill">{groups.find((g) => g.slug === group)?.label ?? group}</span>
              <button type="button" className={`exm-state ${save.state}`} aria-live="polite" onClick={save.state === "error" ? save.retry : undefined} title={save.state === "error" ? "Click to try again" : undefined}>
                {save.state === "saved" ? "Saved" : save.state === "saving" ? "Saving…" : "Not saved"}
              </button>
            </div>
            <DialogDescription className="sr-only">Changes show in every programme that uses it{used > 0 ? ` · used by ${used} client${used === 1 ? "" : "s"}` : ""}.</DialogDescription>
          </div>
          <button type="button" className="exm-close" onClick={() => void done()} aria-label="Close">
            ✕
          </button>
        </header>

        {/* ---- Body */}
        <div className="exm-body">
          {/* ---- Demo */}
          <section className="exm-col">
            {sectionLabel("Demo")}
            <div className="exm-panel">
              <div
                className={`exm-preview${demo ? "" : " empty"}${dragOver ? " over" : ""}`}
                onDragOver={(e) => {
                  if (!e.dataTransfer.types.includes("Files")) return;
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDragOver(false)}
                onDrop={(e) => {
                  if (!e.dataTransfer.types.includes("Files")) return;
                  e.preventDefault();
                  setDragOver(false);
                  void upload(e.dataTransfer.files[0]);
                }}
              >
                {demo && isUpload(demo) && !pendingUpload ? (
                  playing ? (
                    <video className="exm-player" src={demo} controls autoPlay playsInline />
                  ) : (
                    <>
                      <Poster url={demo} large onDuration={setDemoSeconds} />
                      <button type="button" className="exm-play" onClick={() => setPlaying(true)} aria-label="Play the demo">
                        <PlayIcon />
                      </button>
                      <span className="exm-chip top-left">{fileName(demo)}</span>
                      {demoSeconds != null && <span className="exm-chip bottom-left strong">{fmtDuration(demoSeconds)}</span>}
                      <button type="button" className="exm-remove" onClick={removeDemo}>
                        Remove
                      </button>
                    </>
                  )
                ) : demo && pendingUpload ? (
                  <>
                    <span className="exm-poster large" aria-hidden="true" />
                    <span className="exm-chip top-left">{pendingUpload.name}</span>
                    <span className="exm-uploading">Saved · reading it back…</span>
                  </>
                ) : demo ? (
                  <>
                    <Poster url={demo} large />
                    <a className="exm-play" href={demo} target="_blank" rel="noreferrer" aria-label="Open the demo">
                      <PlayIcon />
                    </a>
                    <span className="exm-chip top-left">{providerOf(demo)}</span>
                    <button type="button" className="exm-remove" onClick={removeDemo}>
                      Remove
                    </button>
                  </>
                ) : (
                  <>
                    <b>Drop a video here</b>
                    <small>MP4 or MOV · up to 128 MB</small>
                    <button type="button" className="exm-upload-btn" disabled={!!uploading} onClick={() => fileInput.current?.click()}>
                      Upload from computer
                    </button>
                  </>
                )}
                {uploading && (
                  <>
                    <span className="exm-uploading">Uploading {uploading}…</span>
                    <span className="exm-progress" aria-hidden="true" />
                  </>
                )}
              </div>
              <input ref={fileInput} type="file" accept="video/*" hidden onChange={(e) => void upload(e.target.files?.[0]).then(() => (e.target.value = ""))} />

              <div className="exm-mini-block">
                <span className="exm-mini">Or link</span>
                <label className={`exm-linkfield${linkBad ? " bad" : ""}`}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
                  </svg>
                  <input
                    value={link}
                    onChange={(e) => {
                      setLink(e.target.value);
                      setLinkBad(false);
                    }}
                    onBlur={useLink}
                    onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                    placeholder="YouTube, Vimeo or any link"
                    aria-label="Demo link"
                  />
                </label>
                {linkBad ? <small className="exm-err">That doesn&rsquo;t look like a link</small> : demo && isUpload(demo) && link.trim() ? <small className="exm-faint">Clients see the uploaded video</small> : null}
              </div>

              <div className="exm-mini-block">
                <div className="exm-mini-row">
                  <span className="exm-mini">Your videos</span>
                  <button type="button" className="exm-textbtn" disabled={!!uploading} onClick={() => fileInput.current?.click()}>
                    + Upload
                  </button>
                </div>
                {videos.length === 0 ? (
                  <small className="exm-faint">None yet. Upload one above.</small>
                ) : (
                  <div className="exm-videos">
                    {shownVideos.map((v) => {
                      const on = demo === v.path;
                      const usedOn = v.usedBy.map((u) => u.name).join(", ");
                      return (
                        <button key={v.id} type="button" className={`exm-vid${on ? " on" : ""}`} onClick={() => setDemoVideo(v.id, v.path)} title={`${v.name} · ${usedOn ? `Used on ${usedOn}` : "Not used yet"}`} aria-label={`${v.name}${on ? ", the demo" : ""}`} aria-pressed={on}>
                          <VideoThumb path={v.path} />
                          {on && (
                            <span className="exm-vid-check" aria-hidden="true">
                              <CheckIcon />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                {videos.length > 6 && (
                  <button type="button" className="exm-textbtn" onClick={() => setAllVideos((x) => !x)}>
                    {allVideos ? "Show fewer" : `See all ${videos.length}`}
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* ---- Details */}
          <section className="exm-col exm-details">
            <label className="exm-field">
              {sectionLabel("Name")}
              <input className="exm-input name" value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} placeholder="Exercise name" maxLength={60} />
              {nameHint && <small className="exm-err">{nameHint}</small>}
            </label>

            <div className="exm-field">
              {sectionLabel("Muscle group")}
              <div className="exm-tiles" role="radiogroup" aria-label="Muscle group">
                {groups.map((g) => {
                  const c = groupColour(g.slug);
                  const on = g.slug === group;
                  return (
                    <button key={g.slug} type="button" role="radio" aria-checked={on} className={`exm-tile${on ? " on" : ""}`} style={{ "--c": c.color, "--rgb": c.rgb } as React.CSSProperties} onClick={() => pickGroup(g.slug)}>
                      {g.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="exm-field">
              {sectionLabel("Default cue")}
              <input
                className="exm-input"
                value={cue}
                maxLength={120}
                placeholder="e.g. Pull your elbow to your hip"
                onChange={(e) => {
                  setCue(e.target.value);
                  save.later("cue", patch({ cue: e.target.value.trim() || null }));
                }}
                onBlur={() => save.now("cue")}
              />
              <small className="exm-faint">Clients see it under the exercise name. You can override it per session.</small>
            </label>

            {/* ---- Variations and substitutes, a tab each */}
            <div className="exm-tabs" role="tablist" aria-label="Variations or substitutes">
              <button type="button" role="tab" aria-selected={tab === "variations"} className={`exm-tab${tab === "variations" ? " on" : ""}`} onClick={() => setTab("variations")}>
                Variations <span className="exm-count">{vars.length}</span>
              </button>
              <button type="button" role="tab" aria-selected={tab === "substitutes"} className={`exm-tab${tab === "substitutes" ? " on" : ""}`} onClick={() => setTab("substitutes")}>
                Substitutes
                <span className="exm-count">{subs.length}</span>
              </button>
            </div>
            {tab === "variations" && (
            <div className="exm-field" role="tabpanel">
              <small className="exm-faint">Same movement, different grip or setup. Pick one per client.</small>
              {vars.map((v, i) => {
                const linkShown = v.video && !isUpload(v.video) && !v.cue ? v.video : v.cue;
                const hasLink = !!v.video && !isUpload(v.video);
                return (
                  <div
                    key={v.id}
                    className="exm-row var"
                    draggable
                    onDragStart={(e) => {
                      dragVar.current = i;
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(e) => dragVar.current != null && e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragVar.current != null) moveVar(dragVar.current, i);
                      dragVar.current = null;
                    }}
                  >
                    <button
                      type="button"
                      className="exm-handle"
                      aria-label={`Variation ${i + 1}: move with Alt and the arrow keys`}
                      onKeyDown={(e) => {
                        if (!e.altKey) return;
                        if (e.key === "ArrowUp") {
                          e.preventDefault();
                          moveVar(i, i - 1);
                        } else if (e.key === "ArrowDown") {
                          e.preventDefault();
                          moveVar(i, i + 1);
                        }
                      }}
                    >
                      ⋮⋮
                    </button>
                    <div className="exm-slot-wrap">
                      {v.video ? (
                        <button type="button" className="exm-slot has" onClick={() => setVarMenu(varMenu === v.id ? null : v.id)} aria-label={`${v.name || "Variation"} demo`} aria-expanded={varMenu === v.id}>
                          <Poster url={v.video} />
                          <span className="exm-slot-play" aria-hidden="true">
                            <PlayIcon />
                          </span>
                        </button>
                      ) : (
                        <button type="button" className="exm-slot" onClick={() => setVarMenu(varMenu === v.id ? null : v.id)} aria-expanded={varMenu === v.id}>
                          + Demo
                        </button>
                      )}
                      {varMenu === v.id && (
                        <div className="exm-popover" role="menu">
                          {v.video && (
                            <a role="menuitem" href={v.video} target="_blank" rel="noreferrer" onClick={() => setVarMenu(null)}>
                              Play
                            </a>
                          )}
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              varFileFor.current = v.id;
                              setVarMenu(null);
                              varFileInput.current?.click();
                            }}
                          >
                            {v.video ? "Replace: upload" : "Upload"}
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setVarMenu(null);
                              setVarLinkFor(v.id);
                              setVarLink(hasLink ? v.video! : "");
                            }}
                          >
                            {v.video ? "Replace: a link" : "A link"}
                          </button>
                          {videos.length > 0 && (
                            <div className="exm-popover-videos">
                              <span className="exm-mini">Your videos</span>
                              {videos.slice(0, 8).map((x) => (
                                <button
                                  key={x.id}
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setVarMenu(null);
                                    saveVars(vars.map((y) => (y.id === v.id ? { ...y, video: x.path } : y)));
                                  }}
                                >
                                  {x.name}
                                </button>
                              ))}
                            </div>
                          )}
                          {v.video && (
                            <button
                              type="button"
                              role="menuitem"
                              className="danger"
                              onClick={() => {
                                setVarMenu(null);
                                saveVars(vars.map((y) => (y.id === v.id ? { ...y, video: null } : y)));
                              }}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      )}
                      {varLinkFor === v.id && (
                        <div className="exm-popover">
                          <input
                            autoFocus
                            className="exm-input small"
                            value={varLink}
                            onChange={(e) => setVarLink(e.target.value)}
                            placeholder="Paste a link"
                            aria-label="Demo link"
                            onKeyDown={(e) => {
                              if (e.key === "Escape") setVarLinkFor(null);
                              if (e.key === "Enter") {
                                e.preventDefault();
                                if (isUrl(varLink)) {
                                  saveVars(vars.map((y) => (y.id === v.id ? { ...y, video: varLink.trim() } : y)));
                                  setVarLinkFor(null);
                                }
                              }
                            }}
                            onBlur={() => setVarLinkFor(null)}
                          />
                        </div>
                      )}
                    </div>
                    <input
                      data-var-name={v.id}
                      className="exm-input small"
                      value={v.name}
                      maxLength={40}
                      placeholder="Name, e.g. Close grip"
                      aria-label={`Variation ${i + 1} name`}
                      onChange={(e) => saveVarsLater(vars.map((y) => (y.id === v.id ? { ...y, name: e.target.value } : y)))}
                      onBlur={() => {
                        if (!v.name.trim() && !v.video && !v.cue.trim()) saveVars(vars.filter((y) => y.id !== v.id));
                        else save.now("vars");
                      }}
                    />
                    <span className={`exm-cuefield${hasLink && !v.cue ? " linked" : ""}`}>
                      <input
                        className="exm-input small"
                        value={linkShown}
                        maxLength={300}
                        placeholder="Cue, or a link to a demo"
                        aria-label={`Variation ${i + 1} cue`}
                        onChange={(e) => {
                          const t = e.target.value;
                          saveVarsLater(vars.map((y) => (y.id === v.id ? (isUrl(t) ? { ...y, video: t.trim(), cue: "" } : { ...y, cue: t, video: hasLink ? null : y.video }) : y)));
                        }}
                        onBlur={() => save.now("vars")}
                      />
                      {hasLink && !v.cue && (
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
                        </svg>
                      )}
                    </span>
                    <button type="button" className="exm-rowbtn" onClick={() => removeVariation(v)} aria-label={`Delete variation ${v.name || i + 1}`}>
                      <TrashIcon />
                    </button>
                  </div>
                );
              })}
              <input
                ref={varFileInput}
                type="file"
                accept="video/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  const id = varFileFor.current;
                  e.target.value = "";
                  if (id != null) void upload(f, id);
                }}
              />
              <button type="button" className="exm-addrow" onClick={addVariation}>
                <PlusIcon /> Add variation
              </button>
            </div>
            )}

            {tab === "substitutes" && (
            <div className="exm-field" role="tabpanel">
              <small className="exm-faint">Offered when the machine&rsquo;s taken, in every programme unless a session sets its own.</small>
              {subs.map((s, i) => {
                const x = byId(s.exerciseId);
                const c = groupColour(x?.group);
                return (
                  <div
                    key={s.exerciseId}
                    className="exm-row sub"
                    style={{ "--c": c.color, "--rgb": c.rgb } as React.CSSProperties}
                    role="group"
                    aria-label={`Substitute ${i + 1} of ${subs.length}, ${s.name}`}
                    draggable
                    onDragStart={(e) => {
                      dragSub.current = i;
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(e) => dragSub.current != null && e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragSub.current != null) moveSub(dragSub.current, i);
                      dragSub.current = null;
                    }}
                  >
                    <button
                      type="button"
                      className="exm-rank"
                      aria-label={`Substitute ${i + 1}: move with Alt and the arrow keys`}
                      onKeyDown={(e) => {
                        if (!e.altKey) return;
                        if (e.key === "ArrowUp") {
                          e.preventDefault();
                          moveSub(i, i - 1);
                        } else if (e.key === "ArrowDown") {
                          e.preventDefault();
                          moveSub(i, i + 1);
                        }
                      }}
                    >
                      {i + 1}
                    </button>
                    <span className={`exm-subthumb${x?.video ? "" : " none"}`}>{x?.video ? <Poster url={x.video} /> : "No demo"}</span>
                    <span className="exm-subinfo">
                      <button type="button" className="exm-subname" onClick={() => onOpenOther(s.exerciseId)} title={`Open ${s.name}`}>
                        {s.name}
                      </button>
                      <span className="exm-subline">
                        <span className="exm-minipill">{groups.find((g) => g.slug === x?.group)?.label ?? "Other"}</span>
                        <small>{x?.video ? "Demo attached" : "No demo yet"}</small>
                      </span>
                    </span>
                    <input
                      className="exm-input small"
                      value={s.note}
                      maxLength={120}
                      placeholder="Note for the client · optional, e.g. same reps, a little lighter"
                      aria-label={`Note on ${s.name}`}
                      onChange={(e) => saveSubs(subs.map((y) => (y.exerciseId === s.exerciseId ? { ...y, note: e.target.value } : y)), true)}
                      onBlur={() => save.now("subs")}
                    />
                    <button type="button" className="exm-rowbtn x" onClick={() => removeSub(s)} aria-label={`Remove ${s.name}`}>
                      ✕
                    </button>
                  </div>
                );
              })}
              {subs.length < MAX_SUBS ? (
                <div className="exm-search-wrap" ref={searchWrap}>
                  <label className="exm-search">
                    <SearchIcon />
                    <input
                      ref={searchRef}
                      value={q}
                      onChange={(e) => {
                        setQ(e.target.value);
                        setCursor(0);
                        setSearchOpen(true);
                      }}
                      onFocus={() => setSearchOpen(true)}
                      onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          setCursor((c) => Math.min(candidates.length - 1, c + 1));
                        } else if (e.key === "ArrowUp") {
                          e.preventDefault();
                          setCursor((c) => Math.max(0, c - 1));
                        } else if (e.key === "Enter") {
                          e.preventDefault();
                          if (candidates[cursor]) addSub(candidates[cursor]);
                          else if (q.trim()) void createAndAdd();
                        } else if (e.key === "Escape") setSearchOpen(false);
                      }}
                      placeholder="Add a substitute: search the library"
                      aria-label="Add a substitute"
                    />
                  </label>
                  {searchOpen && (
                    <div className="exm-dropdown" role="listbox">
                      <span className="exm-mini">{q.trim() ? "Results" : `Suggested · ${groups.find((g) => g.slug === group)?.label ?? group}`}</span>
                      {candidates.map((x, k) => {
                        const c = groupColour(x.group);
                        return (
                          <button key={x.id} type="button" role="option" aria-selected={k === cursor} className={`exm-option${k === cursor ? " on" : ""}`} onMouseDown={(e) => e.preventDefault()} onClick={() => addSub(x)} onMouseEnter={() => setCursor(k)}>
                            <b>{x.name}</b>
                            <span className="exm-minipill" style={{ "--c": c.color, "--rgb": c.rgb } as React.CSSProperties}>
                              {groups.find((g) => g.slug === x.group)?.label ?? "Other"}
                            </span>
                            <small>{x.video ? "Has demo" : "No demo"}</small>
                          </button>
                        );
                      })}
                      {candidates.length === 0 && (
                        <div className="exm-nomatch">
                          {q.trim() ? (
                            <>
                              No match. Add &ldquo;{q.trim()}&rdquo; to the library first.{" "}
                              <button type="button" className="exm-textbtn" onMouseDown={(e) => e.preventDefault()} onClick={() => void createAndAdd()} disabled={creating}>
                                {creating ? "Adding…" : "Create exercise"}
                              </button>
                            </>
                          ) : (
                            "Nothing else in this group yet. Type to search the whole library."
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <small className="exm-faint">That&rsquo;s plenty. Remove one to add another.</small>
              )}
            </div>
            )}
          </section>
        </div>

        {/* ---- Footer */}
        <footer className="exm-foot">
          <small className="exm-faint">Demos, links, variations and substitutes save as you set them.</small>
          <button type="button" className="exm-done" onClick={() => void done()} disabled={closing}>
            {closing ? <span className="exm-spin" aria-hidden="true" /> : null}
            Done
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

/** A thumb in Your videos: the clip's first frame, its length bottom-right. */
function VideoThumb({ path }: { path: string }) {
  const [seconds, setSeconds] = useState<number | null>(null);
  return (
    <>
      <video className="exm-poster" src={`${path}#t=0.5`} preload="metadata" muted playsInline draggable={false} onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setSeconds(e.currentTarget.duration)} />
      {seconds != null && <span className="exm-vid-len">{fmtDuration(seconds)}</span>}
    </>
  );
}
