"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import type React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Toaster } from "../../../components/ui/toast";
import { Button, Card, CardContent, Tabs, TabsList, TabsTrigger } from "../../../components/ui/basics";
import { Input } from "../../../components/ui/form";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../../components/ui/dropdown-menu";
import { MoreIcon, PencilIcon, PlayIcon, PlusIcon, TrashIcon } from "../../../components/icons";
import { archiveLibraryExerciseAction, assignVideoToExerciseAction, deleteLibraryVideoAction, renameLibraryVideoAction, uploadLibraryVideoAction } from "./actions";
import type { LibraryData, LibraryItem, LibraryVideo } from "./load";
import ExerciseEditor from "./ExerciseEditor";
import ExerciseDrawer, { DRAWER_WIDTH } from "./ExerciseDrawer";
import { groupColour } from "../../../lib/muscleGroups";
import ExerciseLibraryGrid from "./ExerciseLibraryGrid";

// The coach's Library (5 Oct, rebuilt 6 Oct on the shadcn parts and the
// Training tab's rows). Three shelves on tabs:
// - Exercises: one folded row a muscle group, laid out like a session on the
//   Training tab (chevron, name, "N exercises", a badge, ⋯), its exercises as
//   rows inside, "+ New exercise" at the foot.
// - Cardio: the movements filed under Cardio, the same way.
// - Videos: the coach's own clips, uploaded by the session, each handed to
//   an exercise (the one its file name matches is offered first).
// A click on an exercise opens it: name, group, default cue, its demo and
// its variations, with the videos underneath to drag onto any demo slot.
// Taking an exercise out of the library (its row's bin) hides it from the
// pickers; wherever it is already prescribed, it stays.

type Shelf = "exercises" | "cardio" | "videos";

/** "lat_pulldown-2" and "Lat Pulldown" compare the same. */
const norm = (s: string) => s.toLowerCase().replace(/\.[a-z0-9]{2,5}$/, "").replace(/[^a-z0-9]+/g, " ").replace(/\b\d+\b/g, " ").replace(/\s+/g, " ").trim();

export default function LibraryDraft({ data }: { data: LibraryData }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [shelf, setShelf] = useState<Shelf>("exercises");
  const [showRemoved, setShowRemoved] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  // A substitute opened from an exercise's editor (14 Oct): the one to go back to.
  const [openFrom, setOpenFrom] = useState<{ id: number; name: string } | null>(null);
  // The editor keeps showing while the drawer slides out (14 Oct).
  const [closingItem, setClosingItem] = useState<LibraryItem | null>(null);
  const openItem = (id: number) => setOpenId(id);
  const closeEditor = () => {
    setClosingItem(open);
    setOpenId(null);
    setCreating(null);
    setOpenFrom(null);
    setTimeout(() => setClosingItem(null), 240);
  };
  // The drawer (14 Oct): the URL names the open exercise, so a reload or a shared link reopens it.
  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get("edit"));
    if (!id) return;
    const t = setTimeout(() => setOpenId(id), 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (openId != null) url.searchParams.set("edit", String(openId));
    else url.searchParams.delete("edit");
    window.history.replaceState(null, "", url.toString());
  }, [openId]);
  // The edited card stays in view: the page scrolls (never scrollIntoView) when the card sits under the drawer or off the screen.
  useEffect(() => {
    if (openId == null) return;
    const t = setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-exercise-id="${openId}"]`);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const hidden = r.top < 80 || r.bottom > window.innerHeight - 20 || r.right > window.innerWidth - (window.innerWidth > 720 ? DRAWER_WIDTH : 0);
      if (hidden) window.scrollTo({ top: Math.max(0, window.scrollY + r.top - 120), behavior: "smooth" });
    }, 320);
    return () => clearTimeout(t);
  }, [openId]);
  const [creating, setCreating] = useState<string | null>(null);
  const act = (fn: () => Promise<unknown>, said?: string) =>
    start(async () => {
      await fn();
      router.refresh();
      if (said) toast.success(said);
    });

  const groups = data.groups.filter((g) => g.slug !== "cardio");
  const onShelf = data.items.filter((i) => (shelf === "cardio" ? i.group === "cardio" : i.group !== "cardio"));
  const removedCount = onShelf.filter((i) => i.archived).length;
  const open = openId != null ? data.items.find((i) => i.id === openId) ?? null : null;
  // New in {Group} (14 Oct): the editor on a draft with no id; it exists once named.
  const draft: LibraryItem | null = creating != null ? { id: 0, name: "", group: creating, video: null, cue: "", clients: 0, archived: false, variations: [], substitutes: [] } : null;
  // What the editor shows: the open one, a draft, or the one it is closing on.
  const shownItem = open ?? draft ?? closingItem;

  const archive = (i: LibraryItem) => act(() => archiveLibraryExerciseAction(i.id, !i.archived), i.archived ? `${i.name} back in the library` : `${i.name} taken out of the library`);

  // An exercise, as a row inside its group: like an exercise inside a session.
  return (
    <div className={`rd lb${open ? " lb-drawer-open" : ""}`}>
      <header className="rd-head">
        <div className="rd-head-main">
          <span className="rd-eyebrow">Library</span>
          <h1 className="rd-title">{shelf === "cardio" ? "Cardio movements" : shelf === "videos" ? "Videos" : "Exercises"}</h1>
          {shelf === "videos" && <span className="rd-sub">{`${data.videos.length} ${data.videos.length === 1 ? "video" : "videos"} · ${data.videos.filter((v) => v.usedBy.length === 0).length} not used yet`}</span>}
        </div>
        <div className="rd-head-actions">
          <Tabs
            value={shelf}
            onValueChange={(v) => setShelf(v as Shelf)}
          >
            <TabsList aria-label="Shelf">
              <TabsTrigger value="exercises">Exercises</TabsTrigger>
              <TabsTrigger value="cardio">Cardio</TabsTrigger>
              <TabsTrigger value="videos">Videos</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>

      {shelf === "videos" ? (
        <VideosShelf
          videos={data.videos}
          items={data.items.filter((i) => !i.archived)}
          onChanged={() => router.refresh()}
          onAssign={(exerciseId, videoId, name) => act(() => assignVideoToExerciseAction(exerciseId, videoId), `Demo on ${name}`)}
          onDelete={(v) => act(() => deleteLibraryVideoAction(v.id), `${v.name} deleted`)}
          onRename={(v, name) => act(() => renameLibraryVideoAction(v.id, name), `Renamed to ${name}`)}
        />
      ) : (
        <ExerciseLibraryGrid
          items={onShelf.filter((i) => showRemoved || !i.archived)}
          groups={groups}
          cardio={shelf === "cardio"}
          removedShown={showRemoved}
          removedCount={removedCount}
          onToggleRemoved={() => setShowRemoved((v) => !v)}
          onOpen={openItem}
          onNew={(slug) => setCreating(slug)}
          onArchive={archive}
          onChanged={() => router.refresh()}
          editingId={openId}
        />
      )}

      <ExerciseDrawer open={open != null || creating != null} colour={groupColour(shownItem?.group)} onClose={closeEditor} onCardUnder={(id) => openItem(id)}>
        {shownItem && (
          <ExerciseEditor
            key={shownItem.id}
            item={shownItem}
            items={data.items}
            videos={data.videos}
            groups={data.groups}
            siblings={data.items
              .filter((i) => i.group === shownItem.group && !i.archived)
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((i) => i.id)}
            backTo={openFrom && openFrom.id !== shownItem.id ? openFrom : null}
            onClose={closeEditor}
            onSwitch={(id) => {
              setOpenFrom(null);
              setOpenId(id);
            }}
            onOpenOther={(id) => {
              setOpenFrom(openFrom && id === openFrom.id ? null : { id: shownItem.id, name: shownItem.name });
              setOpenId(id);
            }}
            onChanged={() => router.refresh()}
            onCreated={(id) => {
              setCreating(null);
              setOpenId(id);
            }}
          />
        )}
      </ExerciseDrawer>

      <Toaster />
    </div>
  );
}

/** Uploads clips one after another; says how far it has got through `onProgress`. */
async function uploadAll(files: File[], onProgress: (p: { done: number; total: number; current: string } | null) => void): Promise<{ count: number; errors: string[] }> {
  const list = files.filter((f) => f.type.startsWith("video/"));
  const errors: string[] = [];
  for (let i = 0; i < list.length; i++) {
    onProgress({ done: i, total: list.length, current: list[i].name });
    const f = new FormData();
    f.set("file", list[i]);
    const r = await uploadLibraryVideoAction(f).catch(() => ({ ok: false as const, error: `${list[i].name} didn't upload.` }));
    if (!r.ok) errors.push(r.error);
  }
  onProgress(null);
  return { count: list.length, errors };
}

/**
 * The coach's own videos: upload a whole session's clips at once (one after
 * another, with how far it has got), then hand each to an exercise. The
 * exercise its file name matches is offered first, one click.
 */
function VideosShelf({
  videos,
  items,
  onChanged,
  onAssign,
  onDelete,
  onRename,
}: {
  videos: LibraryVideo[];
  items: LibraryItem[];
  onChanged: () => void;
  onAssign: (exerciseId: number, videoId: number | null, name: string) => void;
  onDelete: (v: LibraryVideo) => void;
  onRename: (v: LibraryVideo, name: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<{ done: number; total: number; current: string } | null>(null);
  const [drag, setDrag] = useState(false);
  const [unusedOnly, setUnusedOnly] = useState(false);
  // The clip whose name is being typed, in place of its title.
  const [renaming, setRenaming] = useState<number | null>(null);
  // The clip playing large, with sound.
  const [playing, setPlaying] = useState<LibraryVideo | null>(null);
  const upload = async (files: File[]) => {
    const { count, errors } = await uploadAll(files, setQueue);
    if (!count) return;
    onChanged();
    if (errors.length) toast.error(errors.join(" "));
    else toast.success(`${count} ${count === 1 ? "video" : "videos"} uploaded`);
  };
  // The exercise a clip's file name matches, if one does and it has no demo yet.
  const suggest = (v: LibraryVideo) => {
    const n = norm(v.name);
    if (!n) return null;
    return items.find((i) => !i.video && norm(i.name) === n) ?? items.find((i) => !i.video && (n.includes(norm(i.name)) || norm(i.name).includes(n)) && norm(i.name).length > 3) ?? null;
  };
  const shown = unusedOnly ? videos.filter((v) => v.usedBy.length === 0) : videos;
  return (
    <>
      <Card
        className={`lb-drop${drag ? " over" : ""}`}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDrag(false)}
        onDrop={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setDrag(false);
          if (!queue) void upload([...e.dataTransfer.files]);
        }}
      >
        <CardContent className="lb-drop-body">
          {queue ? (
            <span className="lb-drop-progress">
              Uploading {queue.done + 1} of {queue.total} · <b>{queue.current}</b>
              <i style={{ width: `${(queue.done / queue.total) * 100}%` }} />
            </span>
          ) : (
            <>
              <span>Drop a whole session&rsquo;s videos here, or</span>
              <Button onClick={() => input.current?.click()}>
                <PlusIcon /> Upload videos
              </Button>
              <small>Up to 128MB each. They stay here until you give them to an exercise.</small>
            </>
          )}
          <input
            ref={input}
            type="file"
            accept="video/*"
            multiple
            hidden
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              e.target.value = "";
              void upload(files);
            }}
          />
        </CardContent>
      </Card>
      {videos.length > 0 && (
        <div className="lb-tools">
          <Button variant={unusedOnly ? "default" : "outline"} size="sm" aria-pressed={unusedOnly} onClick={() => setUnusedOnly((v) => !v)}>
            Not used yet · {videos.filter((v) => v.usedBy.length === 0).length}
          </Button>
        </div>
      )}
      {shown.length === 0 ? (
        <p className="lb-empty">{videos.length ? "Every video is in use." : "No videos yet."}</p>
      ) : (
        // The clips as cards (14 Oct, Alex), laid out as the exercises are: the clip, its length, its size and date; no title.
        <div className="lib-grid lib-videos">
          {shown.map((v, k) => (
            <VideoCard key={v.id} v={v} index={k} hint={v.usedBy.length === 0 ? suggest(v) : null} renaming={renaming === v.id} onRename={(name) => { setRenaming(null); if (name && name !== v.name) onRename(v, name); }} onStartRename={() => setRenaming(v.id)} onDelete={() => onDelete(v)} onAssign={(ex) => onAssign(ex.id, v.id, ex.name)} onPlay={() => setPlaying(v)} />
          ))}
        </div>
      )}
      {playing &&
        createPortal(
          <div className="exm-lightbox" role="dialog" aria-label={playing.name} onClick={() => setPlaying(null)}>
            <div className="exm-lightbox-card" onClick={(e) => e.stopPropagation()}>
              <video src={playing.path} controls autoPlay playsInline />
              <div className="exm-lightbox-row">
                <span className="exm-lightbox-text">
                  <b>{playing.name}</b>
                  <small>{playing.usedBy.length ? `On ${playing.usedBy.map((e) => e.name).join(", ")}` : "Not on an exercise yet"}</small>
                </span>
                <button type="button" className="exm-close" onClick={() => setPlaying(null)} aria-label="Close">
                  ✕
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

const fmtDuration = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
const fmtBytes = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(n >= 10 * 1024 * 1024 ? 0 : 1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const FALLBACKS = ["linear-gradient(150deg,#55648a,#1a2030)", "linear-gradient(150deg,#4a6b7a,#162028)", "linear-gradient(150deg,#665a7d,#1c1828)", "linear-gradient(150deg,#5a6f5f,#18221c)"];

/** One clip as a card: its first frame with a play disc and its length, then its size and date; ⋯ renames or deletes it; a matching exercise with no demo is offered. */
function VideoCard({ v, index, hint, renaming, onRename, onStartRename, onDelete, onAssign, onPlay }: { v: LibraryVideo; index: number; hint: LibraryItem | null; renaming: boolean; onRename: (name: string) => void; onStartRename: () => void; onDelete: () => void; onAssign: (ex: LibraryItem) => void; onPlay: () => void }) {
  const [seconds, setSeconds] = useState<number | null>(null);
  return (
    <div className="lib-card">
      <div className="lib-thumb portrait" style={{ background: FALLBACKS[index % FALLBACKS.length] }}>
        <video className="lib-poster" src={`${v.path}#t=0.5`} preload="metadata" muted playsInline onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setSeconds(e.currentTarget.duration)} />
        <span className="lib-shade" aria-hidden="true" />
        <button type="button" className="lib-play" aria-label={`Play ${v.name}`} onClick={onPlay}>
          <PlayIcon />
        </button>
        {seconds != null && <span className="lib-chip-dur">{fmtDuration(seconds)}</span>}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button type="button" className="lib-edit" aria-label={`More for ${v.name}`}>
              <MoreIcon />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="pb-menu">
            <DropdownMenuItem onSelect={onStartRename}>
              <PencilIcon /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <TrashIcon /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="lib-body">
        {renaming && (
          <Input
            autoFocus
            className="h-8"
            defaultValue={v.name}
            maxLength={120}
            aria-label="Video name"
            onBlur={(e) => onRename(e.target.value.trim())}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                e.currentTarget.value = v.name;
                e.currentTarget.blur();
              }
            }}
          />
        )}
        <span className="lib-cue" title={v.name}>
          {[v.bytes != null ? fmtBytes(v.bytes) : null, fmtDate(v.at)].filter(Boolean).join(" · ")}
        </span>
        <span className="lib-cardchips">
          {v.usedBy.length > 0 ? (
            <span className="lib-cardchip navy" title={v.usedBy.map((e) => e.name).join(", ")}>
              On {v.usedBy.length === 1 ? v.usedBy[0].name : `${v.usedBy.length} exercises`}
            </span>
          ) : hint ? (
            <button type="button" className="lib-cardchip navy lib-cardchip-btn" onClick={() => onAssign(hint)}>
              Use for {hint.name}
            </button>
          ) : (
            <span className="lib-cardchip">Not used yet</span>
          )}
        </span>
      </div>
    </div>
  );
}

/** Under an exercise's rows in its dialog: every video of the coach's to drag up onto a demo slot, and new ones dropped or uploaded here. */
