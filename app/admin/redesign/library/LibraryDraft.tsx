"use client";

import { useRef, useState, useTransition } from "react";
import type React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Toaster } from "../../../components/ui/toast";
import { Badge, Button, Card, CardContent, Tabs, TabsList, TabsTrigger } from "../../../components/ui/basics";
import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from "../../../components/ui/form";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../../components/ui/dropdown-menu";
import { ChevronDownIcon, MoreIcon, PencilIcon, PlusIcon, SearchIcon, TrashIcon } from "../../../components/icons";
import { clearExerciseDemoAction, setExerciseDemoLinkAction } from "../../../lib/actions";
import { archiveLibraryExerciseAction, assignVideoToExerciseAction, createLibraryExerciseAction, deleteLibraryVideoAction, renameLibraryVideoAction, saveExerciseVariationsAction, updateLibraryExerciseAction, uploadLibraryVideoAction } from "./actions";
import type { LibraryData, LibraryItem, LibraryVideo } from "./load";

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

const ytId = (url: string) => /(?:youtu\.be\/|[?&]v=|shorts\/|embed\/)([\w-]{11})/.exec(url)?.[1] ?? null;
const isVideoFile = (url: string) => url.startsWith("/uploads/") || /\.(mp4|mov|m4v|webm)(\?|$)/i.test(url);
/** "lat_pulldown-2" and "Lat Pulldown" compare the same. */
const norm = (s: string) => s.toLowerCase().replace(/\.[a-z0-9]{2,5}$/, "").replace(/[^a-z0-9]+/g, " ").replace(/\b\d+\b/g, " ").replace(/\s+/g, " ").trim();
/** What a video carries while it is dragged: its id. */
const VIDEO_DRAG = "application/x-ironline-video";

/** A demo's picture: YouTube's thumbnail, the clip's first frame, or a plain mark for any other link. */
function Thumb({ url, label }: { url: string | null; label: string }) {
  if (!url) return <span className="lb-thumb none">No demo</span>;
  const id = ytId(url);
  if (id)
    return (
      <span className="lb-thumb">
        {/* eslint-disable-next-line @next/next/no-img-element -- YouTube's own thumbnail */}
        <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt={`${label} demo`} loading="lazy" />
        <i className="lb-play" aria-hidden="true" />
      </span>
    );
  if (isVideoFile(url))
    return (
      <span className="lb-thumb">
        <video src={`${url}#t=0.5`} preload="metadata" muted playsInline aria-label={`${label} demo`} />
        <i className="lb-play" aria-hidden="true" />
      </span>
    );
  return <span className="lb-thumb link">Link</span>;
}

const fmtDuration = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
const fmtBytes = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(n >= 10 * 1024 * 1024 ? 0 : 1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** A video of the coach's, draggable onto a demo: the clip up top, then its name, length, size and date. */
function VideoChip({ v, title, onDelete }: { v: LibraryVideo; title: string; /** Given: a bin on hover; a second click deletes (off every exercise it is on). */ onDelete?: (v: LibraryVideo) => void }) {
  // The length comes from the clip itself once its metadata has loaded.
  const [seconds, setSeconds] = useState<number | null>(null);
  const [full, setFull] = useState(false);
  // The bin asks once: a second click deletes.
  const [confirm, setConfirm] = useState(false);
  const meta = [seconds != null ? fmtDuration(seconds) : null, v.bytes != null ? fmtBytes(v.bytes) : null, fmtDate(v.at)].filter(Boolean).join(" · ");
  return (
    <div
      className="lb-drawer-item"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(VIDEO_DRAG, String(v.id));
        e.dataTransfer.setData("text/plain", v.name);
        e.dataTransfer.effectAllowed = "copy";
      }}
      title={title}
    >
      {onDelete &&
        (confirm ? (
          <Button
            variant="outline"
            size="sm"
            className="lb-vid-del confirm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(v);
            }}
            onMouseLeave={() => setConfirm(false)}
            onBlur={() => setConfirm(false)}
          >
            Delete{v.usedBy.length ? ` · off ${v.usedBy.length}` : ""}?
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="lb-bin lb-vid-del"
            onClick={(e) => {
              e.stopPropagation();
              setConfirm(true);
            }}
            aria-label={`Delete ${v.name}`}
            title="Delete this video"
          >
            <TrashIcon />
          </Button>
        ))}
      <span className="lb-thumb">
        <video src={`${v.path}#t=0.5`} preload="metadata" muted playsInline draggable={false} onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setSeconds(e.currentTarget.duration)} />
      </span>
      <span className="lb-drawer-text">
        {/* A long name: click it to read the whole thing, click again to fold it. */}
        <b className={full ? "full" : ""} title={full ? undefined : v.name} role="button" tabIndex={0} onClick={(e) => (e.stopPropagation(), setFull((x) => !x))} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), setFull((x) => !x))}>
          {v.name}
        </b>
        <span className="lb-drawer-meta">{meta}</span>
        <small className={v.usedBy.length ? "" : "none"}>{v.usedBy.length ? `On ${v.usedBy.map((e) => e.name).join(", ")}` : "Not used yet"}</small>
      </span>
    </div>
  );
}

export default function LibraryDraft({ data }: { data: LibraryData }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [shelf, setShelf] = useState<Shelf>("exercises");
  const [q, setQ] = useState("");
  const [showRemoved, setShowRemoved] = useState(false);
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  // The one exercise whose variations are unfolded under it in the list: opening another, or an exercise itself, folds it.
  const [openVar, setOpenVar] = useState<number | null>(null);
  const toggleVars = (id: number) => setOpenVar((o) => (o === id ? null : id));
  const openItem = (id: number) => {
    setOpenVar(null);
    setOpenId(id);
  };
  const [openId, setOpenId] = useState<number | null>(null);
  const [creating, setCreating] = useState<string | null>(null);
  const act = (fn: () => Promise<unknown>, said?: string) =>
    start(async () => {
      await fn();
      router.refresh();
      if (said) toast.success(said);
    });

  const groups = data.groups.filter((g) => g.slug !== "cardio");
  const needle = q.trim().toLowerCase();
  const filtering = !!needle;
  const onShelf = data.items.filter((i) => (shelf === "cardio" ? i.group === "cardio" : i.group !== "cardio"));
  const shown = onShelf.filter((i) => showRemoved || !i.archived).filter((i) => !needle || i.name.toLowerCase().includes(needle) || i.cue.toLowerCase().includes(needle));
  const removedCount = onShelf.filter((i) => i.archived).length;
  const open = openId != null ? data.items.find((i) => i.id === openId) ?? null : null;
  const toggleGroup = (slug: string) => setOpenGroups((o) => (o.includes(slug) ? o.filter((x) => x !== slug) : [...o, slug]));

  const archive = (i: LibraryItem) => act(() => archiveLibraryExerciseAction(i.id, !i.archived), i.archived ? `${i.name} back in the library` : `${i.name} taken out of the library`);

  // An exercise, as a row inside its group: like an exercise inside a session.
  const row = (i: LibraryItem) => (
    <div key={i.id} className="rd-row">
      <div
        className={`rd-row-main lb-row-main${i.archived ? " archived" : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => openItem(i.id)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), openItem(i.id))}
      >
        <Thumb url={i.video} label={i.name} />
        <span className="rd-ex">
          <span className="rd-ex-name">
            {i.name}
            {i.archived && <Badge className="lb-badge-muted">Taken out</Badge>}
            {i.variations.length > 0 && (
              <button
                type="button"
                className={`lb-varchev${openVar === i.id ? " open" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleVars(i.id);
                }}
                aria-expanded={openVar === i.id}
                aria-label={`${openVar === i.id ? "Fold" : "Show"} the ${i.variations.length} ${i.variations.length === 1 ? "variation" : "variations"} of ${i.name}`}
                title={`${i.variations.length} ${i.variations.length === 1 ? "variation" : "variations"}`}
              >
                <ChevronDownIcon />
              </button>
            )}
          </span>
        </span>
        <span className={`lb-cue${i.cue ? "" : " none"}`}>{i.cue || "No default cue"}</span>
        {/* The bin shows on hover: it takes the exercise out of the library (wherever it is prescribed, it stays). A taken-out row offers Put back instead. */}
        <span className="rd-row-more lb-row-more" onClick={(e) => e.stopPropagation()}>
          {i.archived ? (
            <Button variant="outline" size="sm" onClick={() => archive(i)}>
              Put back
            </Button>
          ) : (
            <Button variant="ghost" size="icon" className="lb-bin" onClick={() => archive(i)} aria-label={`Take ${i.name} out of the library`} title="Take out of the library">
              <TrashIcon />
            </Button>
          )}
        </span>
      </div>
      {/* Unfolded: each variation as a lesser row under its exercise, its own demo (else the exercise's) and cue; a click opens the exercise to edit them. */}
      {openVar === i.id &&
        i.variations.map((v) => (
          <div key={v.id} className="rd-row-main lb-row-main lb-var-row" role="button" tabIndex={0} onClick={() => openItem(i.id)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), openItem(i.id))}>
            <Thumb url={v.video ?? i.video} label={`${i.name} · ${v.name}`} />
            <span className="rd-ex">
              <span className="rd-ex-name">
                <i className="lb-sub-mark" aria-hidden="true" />
                {v.name}
                {!v.video && i.video && <small>uses the exercise&rsquo;s demo</small>}
              </span>
            </span>
            <span className={`lb-cue${v.cue || i.cue ? "" : " none"}`}>{v.cue || i.cue || "No cue"}</span>
            <span className="rd-row-more lb-row-more" onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="lb-bin" onClick={() => act(() => saveExerciseVariationsAction(i.id, i.variations.filter((x) => x.id !== v.id)), `${v.name} deleted`)} aria-label={`Delete ${v.name}`} title="Delete this variation">
                <TrashIcon />
              </Button>
            </span>
          </div>
        ))}
    </div>
  );
  const cols = (
    <div className="rd-cols lb-cols" aria-hidden="true">
      <span>Demo</span>
      <span>Exercise</span>
      <span>Default cue</span>
      <span />
    </div>
  );
  const addRow = (slug: string, label: string) => (
    <button type="button" className="rd-session add lb-add" onClick={() => setCreating(slug)}>
      + {label}
    </button>
  );

  return (
    <div className="rd lb">
      <header className="rd-head">
        <div className="rd-head-main">
          <span className="rd-eyebrow">Library</span>
          <h1 className="rd-title">{shelf === "cardio" ? "Cardio movements" : shelf === "videos" ? "Videos" : "Exercises"}</h1>
          {shelf === "videos" && <span className="rd-sub">{`${data.videos.length} ${data.videos.length === 1 ? "video" : "videos"} · ${data.videos.filter((v) => v.usedBy.length === 0).length} not used yet`}</span>}
        </div>
        <div className="rd-head-actions">
          <Tabs
            value={shelf}
            onValueChange={(v) => {
              setShelf(v as Shelf);
              setQ("");
            }}
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
          groups={data.groups}
          onChanged={() => router.refresh()}
          onAssign={(exerciseId, videoId, name) => act(() => assignVideoToExerciseAction(exerciseId, videoId), `Demo on ${name}`)}
          onDelete={(v) => act(() => deleteLibraryVideoAction(v.id), `${v.name} deleted`)}
          onRename={(v, name) => act(() => renameLibraryVideoAction(v.id, name), `Renamed to ${name}`)}
        />
      ) : (
        <>
          {/* Find: search, and the ones taken out. */}
          <div className="lb-tools">
            <label className="lb-search">
              <SearchIcon />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={shelf === "cardio" ? "Search movements" : "Search exercises or cues"} aria-label="Search the library" />
            </label>
            {removedCount > 0 && (
              <Button variant={showRemoved ? "default" : "outline"} size="sm" aria-pressed={showRemoved} onClick={() => setShowRemoved((v) => !v)}>
                Taken out · {removedCount}
              </Button>
            )}
          </div>

          {/* The groups, spaced as the sessions are on the Training tab. */}
          <div className="rd-sessions">
          {shelf === "cardio" ? (
            <section className="rd-session open lb-cardio">
              <div className="rd-rows">
                {cols}
                {shown.map(row)}
                {shown.length === 0 && <p className="lb-empty">{filtering ? "Nothing matches that." : "No cardio movements yet."}</p>}
                {addRow("cardio", "New movement")}
              </div>
            </section>
          ) : (
            // One folded row a group, like a session on the Training tab; a search opens the ones with matches.
            groups.map((g) => {
              const all = onShelf.filter((i) => i.group === g.slug && !i.archived);
              const inGroup = shown.filter((i) => i.group === g.slug);
              if (filtering && inGroup.length === 0) return null;
              const isOpen = filtering || openGroups.includes(g.slug);
              return (
                <section key={g.slug} className={`rd-session${isOpen ? " open" : ""}`}>
                  <div
                    className="rd-session-head"
                    onClick={(ev) => {
                      if ((ev.target as HTMLElement).closest("button, [role=menuitem]")) return;
                      toggleGroup(g.slug);
                    }}
                  >
                    <button type="button" className="rd-session-toggle" onClick={() => toggleGroup(g.slug)} aria-expanded={isOpen} aria-label={isOpen ? `Fold ${g.label}` : `Open ${g.label}`}>
                      <span className={`rd-chev${isOpen ? " open" : ""}`} aria-hidden="true">
                        <ChevronDownIcon />
                      </span>
                    </button>
                    <span className="rd-session-namecol lb-groupname">
                      <span className="rd-session-name">{g.label}</span>
                    </span>
                    <span className="rd-session-count">
                      {all.length} {all.length === 1 ? "exercise" : "exercises"}
                    </span>
                    <span className="rd-session-tags" />
                  </div>
                  {isOpen && (
                    <div className="rd-rows">
                      {inGroup.length > 0 && cols}
                      {inGroup.map(row)}
                      {inGroup.length === 0 && <p className="lb-empty">Nothing in {g.label} yet.</p>}
                      {addRow(g.slug, `New exercise in ${g.label}`)}
                    </div>
                  )}
                </section>
              );
            })
          )}
          </div>
        </>
      )}

      <Dialog open={open != null} onOpenChange={(o) => !o && setOpenId(null)}>
        {open && (
          <ItemDialog
            key={open.id}
            item={open}
            groups={data.groups}
            videos={data.videos}
            pending={pending}
            onSave={(patch) => {
              setOpenId(null);
              act(() => updateLibraryExerciseAction(open.id, patch), `${patch.name ?? open.name} saved`);
            }}
            onPickVideo={(videoId) => act(() => assignVideoToExerciseAction(open.id, videoId), `${data.videos.find((v) => v.id === videoId)?.name ?? "Video"} is now the demo on ${open.name}`)}
            onDemoLink={(url) =>
              start(async () => {
                const f = new FormData();
                f.set("exerciseId", String(open.id));
                f.set("demoUrl", url);
                const err = await setExerciseDemoLinkAction(f);
                if (err) toast.error(err);
                else {
                  router.refresh();
                  toast.success(`Demo on ${open.name} · every client's sheet with it`);
                }
              })
            }
            onVideosChanged={() => router.refresh()}
            onVideoDelete={(v) => act(() => deleteLibraryVideoAction(v.id), `${v.name} deleted`)}
            onVariations={(list, said) => act(() => saveExerciseVariationsAction(open.id, list), said)}
            onDemoRemove={() => {
              const f = new FormData();
              f.set("exerciseId", String(open.id));
              act(() => clearExerciseDemoAction(f), `Demo taken off ${open.name}`);
            }}
          />
        )}
      </Dialog>

      <Dialog open={creating != null} onOpenChange={(o) => !o && setCreating(null)}>
        {creating != null && (
          <CreateDialog
            group={creating}
            groupLabel={data.groups.find((g) => g.slug === creating)?.label ?? "Other"}
            onCreate={(v) => {
              const group = creating;
              setCreating(null);
              start(async () => {
                const id = await createLibraryExerciseAction(v.name, group, v.cue);
                router.refresh();
                if (id) {
                  toast.success(`${v.name} added to your library`);
                  setOpenGroups((o) => (o.includes(group) ? o : [...o, group]));
                  // Open it, so its demo can go on straight away.
                  setTimeout(() => setOpenId(id), 400);
                }
              });
            }}
          />
        )}
      </Dialog>
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
  groups,
  onChanged,
  onAssign,
  onDelete,
  onRename,
}: {
  videos: LibraryVideo[];
  items: LibraryItem[];
  groups: { slug: string; label: string }[];
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
        <div className="lb-wall">
          {shown.map((v) => {
            const hint = v.usedBy.length === 0 ? suggest(v) : null;
            return (
              <Card key={v.id} className="lb-vid">
                <video className="lb-vid-player" src={`${v.path}#t=0.5`} controls preload="metadata" playsInline />
                <div className="lb-vid-head">
                  {renaming === v.id ? (
                    <Input
                      autoFocus
                      className="h-8"
                      defaultValue={v.name}
                      maxLength={120}
                      aria-label="Video name"
                      onBlur={(e) => {
                        const n = e.target.value.trim();
                        setRenaming(null);
                        if (n && n !== v.name) onRename(v, n);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                        if (e.key === "Escape") {
                          e.currentTarget.value = v.name;
                          e.currentTarget.blur();
                        }
                      }}
                    />
                  ) : (
                    <b title={v.name}>{v.name}</b>
                  )}
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={`More for ${v.name}`}>
                        <MoreIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    {/* Beside the card, not over the clip. */}
                    <DropdownMenuContent side="right" align="start" className="pb-menu">
                      <DropdownMenuItem onSelect={() => setRenaming(v.id)}>
                        <PencilIcon /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onSelect={() => onDelete(v)}>
                        <TrashIcon /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {v.usedBy.length > 0 ? (
                  <Badge className="lb-badge-ok">Demo on {v.usedBy.map((e) => e.name).join(", ")}</Badge>
                ) : hint ? (
                  <Button variant="outline" size="sm" className="lb-vid-hint" onClick={() => onAssign(hint.id, v.id, hint.name)}>
                    Use for {hint.name}
                  </Button>
                ) : (
                  <Badge className="lb-badge-muted">Not on an exercise yet</Badge>
                )}
                <Select
                  value=""
                  onValueChange={(id) => {
                    const ex = items.find((i) => i.id === Number(id));
                    if (ex) onAssign(ex.id, v.id, ex.name);
                  }}
                >
                  <SelectTrigger aria-label={`Give ${v.name} to an exercise`}>
                    <SelectValue placeholder={v.usedBy.length ? "Also use for…" : "Use for exercise…"} />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((g) => {
                      const inGroup = items.filter((i) => i.group === g.slug);
                      return inGroup.length ? (
                        <div key={g.slug}>
                          <SelectItem value={`group:${g.slug}`} disabled className="lb-select-group">
                            {g.label}
                          </SelectItem>
                          {inGroup.map((i) => (
                            <SelectItem key={i.id} value={String(i.id)}>
                              {i.name}
                              {i.video ? " · has a demo" : ""}
                            </SelectItem>
                          ))}
                        </div>
                      ) : null;
                    })}
                  </SelectContent>
                </Select>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

/** Under an exercise's rows in its dialog: every video of the coach's to drag up onto a demo slot, and new ones dropped or uploaded here. */
function DialogVideos({ videos, onChanged, onDelete }: { videos: LibraryVideo[]; onChanged: () => void; onDelete: (v: LibraryVideo) => void }) {
  const [q, setQ] = useState("");
  const [queue, setQueue] = useState<{ done: number; total: number; current: string } | null>(null);
  // Files from the computer held over the panel.
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const needle = q.trim().toLowerCase();
  // Only the clips not on any exercise yet: with a long library, the ones still to place.
  const [unusedOnly, setUnusedOnly] = useState(false);
  const unused = videos.filter((v) => v.usedBy.length === 0).length;
  const shown = videos.filter((v) => (!unusedOnly || v.usedBy.length === 0) && (!needle || v.name.toLowerCase().includes(needle)));
  const upload = async (files: File[]) => {
    const { count, errors } = await uploadAll(files, setQueue);
    if (!count) return;
    onChanged();
    if (errors.length) toast.error(errors.join(" "));
  };
  return (
    <aside
      className={`lb-dlg-videos${drag ? " over" : ""}`}
      aria-label="Your videos"
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
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
      <div className="lb-dlg-videos-head">
        <Label>Your videos</Label>
        {videos.length > 4 && (
          <label className="lb-search">
            <SearchIcon />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search videos" aria-label="Search videos" className="h-8" />
          </label>
        )}
        {videos.length > 0 && (
          <Button variant={unusedOnly ? "default" : "outline"} size="sm" aria-pressed={unusedOnly} onClick={() => setUnusedOnly((x) => !x)}>
            Not used yet · {unused}
          </Button>
        )}
        <Button variant="outline" size="sm" disabled={!!queue} onClick={() => input.current?.click()}>
          <PlusIcon /> Upload
        </Button>
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
      </div>
      {queue && (
        <small className="lb-hint">
          Uploading {queue.done + 1} of {queue.total} · {queue.current}…
        </small>
      )}
      <div className="lb-drawer-list">
        {shown.map((v) => (
          <VideoChip key={v.id} v={v} title={`Drag ${v.name} onto a demo slot`} onDelete={onDelete} />
        ))}
        {shown.length === 0 && <p className="lb-empty">{needle ? "No video matches that." : unusedOnly ? "Every video is on an exercise." : drag ? "Drop to upload" : "No videos yet. Drop videos from your computer here, or Upload; then drag one up onto a demo slot."}</p>}
      </div>
    </aside>
  );
}

/** A demo's slot on a row: the video it has (click to watch), or a dashed box; a video dragged up from the panel below and dropped here becomes the demo. */
function DropSlot({ url, label, small, pending, onDrop, onClear }: { url: string | null; label: string; small?: boolean; pending: boolean; onDrop: (videoId: number) => void; onClear: () => void }) {
  const [over, setOver] = useState(false);
  return (
    <span
      className={`lb-slot${small ? " small" : ""}${over ? " over" : ""}`}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(VIDEO_DRAG)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setOver(true);
      }}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOver(false)}
      onDrop={(e) => {
        setOver(false);
        const id = Number(e.dataTransfer.getData(VIDEO_DRAG));
        if (!id) return;
        e.preventDefault();
        onDrop(id);
      }}
      title={url ? `${label}: open the demo` : `Drop a video here for ${label}`}
    >
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" draggable={false}>
          <Thumb url={url} label={label} />
        </a>
      ) : (
        <span className="lb-thumb none">{over ? "Drop" : "Drop video"}</span>
      )}
      {url && (
        <button type="button" className="lb-slot-x" disabled={pending} onClick={onClear} aria-label={`Take the demo off ${label}`} title="Take the demo off">
          ×
        </button>
      )}
    </span>
  );
}

/** A link as a demo (YouTube, Vimeo…): used on Enter or when the field is left. Keyed on its value by the row, so a saved link reads back. */
function LinkField({ value, label, pending, onUse, onClear, className }: { value: string; label: string; pending: boolean; onUse: (url: string) => void; /** The field emptied while a link was the demo: the demo comes off. */ onClear?: () => void; className?: string }) {
  const [v, setV] = useState(value);
  const use = () => {
    const u = v.trim();
    if (u && u !== value) onUse(u);
    else if (!u && value && onClear) onClear();
  };
  return <Input className={className} value={v} onChange={(e) => setV(e.target.value)} onBlur={use} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} placeholder="Paste a link (YouTube, Vimeo…)" aria-label={`${label} link`} disabled={pending} />;
}

/**
 * One exercise or movement, as rows: the exercise itself up top (its demo,
 * name, group, default cue, a link, and + for a variation), each variation
 * under it as a lesser row (its own demo, name and link), and the coach's
 * videos below to drag up onto any of the demo slots. Name, group and cue
 * save with the button; demos, links and variations save as they are set.
 */
function ItemDialog({
  item,
  groups,
  videos,
  pending,
  onSave,
  onPickVideo,
  onDemoLink,
  onVideosChanged,
  onVideoDelete,
  onVariations,
  onDemoRemove,
}: {
  item: LibraryItem;
  groups: { slug: string; label: string }[];
  videos: LibraryVideo[];
  pending: boolean;
  onSave: (patch: { name?: string; group?: string; cue?: string | null }) => void;
  onPickVideo: (videoId: number) => void;
  onDemoLink: (url: string) => void;
  onVideosChanged: () => void;
  onVideoDelete: (v: LibraryVideo) => void;
  onVariations: (list: { id: number | null; name: string; video: string | null; cue: string }[], said: string) => void;
  onDemoRemove: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [group, setGroup] = useState(item.group);
  const [cue, setCue] = useState(item.cue);
  // A variation being named, in the row that appears for it; null: none.
  const [adding, setAdding] = useState<string | null>(null);
  const changed = name.trim() !== item.name || group !== item.group || cue.trim() !== item.cue;
  const vars = item.variations;
  const videoOf = (id: number) => videos.find((v) => v.id === id) ?? null;
  // An upload is not a link: the link field shows only a pasted one.
  const linkOf = (url: string | null) => (url && !isVideoFile(url) ? url : "");
  const patchVar = (id: number, patch: { name?: string; video?: string | null; cue?: string }, said: string) => onVariations(vars.map((x) => (x.id === id ? { ...x, ...patch } : x)), said);
  const addVariation = () => {
    const n = (adding ?? "").trim();
    setAdding(null);
    if (n) onVariations([...vars, { id: null, name: n, video: null, cue: "" }], `${item.name} · ${n} added`);
  };
  return (
    <DialogContent className="rd-dlg lb-dlg">
      <DialogHeader>
        <DialogTitle>{item.name}</DialogTitle>
        <DialogDescription>Changes show in every programme that uses it.</DialogDescription>
      </DialogHeader>
      <div className="lb-xrows">
        <div className="lb-xhead" aria-hidden="true">
          <Label>Demo</Label>
          <Label>Name</Label>
          <Label>Group</Label>
          <Label>Default cue</Label>
          <Label>Link</Label>
          <span />
        </div>
        <div className="lb-xrow main">
          <DropSlot url={item.video} label={item.name} pending={pending} onDrop={onPickVideo} onClear={onDemoRemove} />
          <Input className="h-[42px] text-[15px] font-bold" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} aria-label="Name" />
          <Select value={group} onValueChange={setGroup}>
            <SelectTrigger className="h-[42px]" aria-label="Group">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {groups.map((g) => (
                <SelectItem key={g.slug} value={g.slug}>
                  {g.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input className="h-[42px]" value={cue} onChange={(e) => setCue(e.target.value)} maxLength={300} placeholder="Pull elbow to hip" aria-label="Default cue" />
          <LinkField key={item.video ?? ""} className="h-[42px]" value={linkOf(item.video)} label={item.name} pending={pending} onUse={onDemoLink} onClear={onDemoRemove} />
          <Button variant="outline" size="icon" disabled={pending || adding != null} onClick={() => setAdding("")} aria-label="Add a variation" title="Add a variation (close grip, wide grip…)">
            <PlusIcon />
          </Button>
        </div>
        {vars.map((v) => (
          <div key={v.id} className="lb-xrow sub">
            <i className="lb-sub-mark" aria-hidden="true" />
            <DropSlot
              small
              url={v.video}
              label={`${item.name} · ${v.name}`}
              pending={pending}
              onDrop={(id) => {
                const vid = videoOf(id);
                if (vid) patchVar(v.id, { video: vid.path }, `${vid.name} is now the demo on ${item.name} · ${v.name}`);
              }}
              onClear={() => patchVar(v.id, { video: null }, `Demo taken off ${v.name}`)}
            />
            <Input
              key={v.name}
              className="h-[38px] font-semibold"
              defaultValue={v.name}
              maxLength={40}
              aria-label="Variation name"
              disabled={pending}
              onBlur={(e) => {
                const n = e.target.value.trim();
                if (n && n !== v.name) patchVar(v.id, { name: n }, `Renamed to ${n}`);
                else e.target.value = v.name;
              }}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            />
            {/* Its own cue: the note a session row starts with when this variation is picked. Empty: the exercise's. */}
            <Input
              key={`c${v.cue}`}
              className="h-[38px]"
              defaultValue={v.cue}
              maxLength={300}
              placeholder={item.cue ? `Cue · else "${item.cue}"` : "Cue for this variation"}
              aria-label="Variation cue"
              disabled={pending}
              onBlur={(e) => {
                const c = e.target.value.trim();
                if (c !== v.cue) patchVar(v.id, { cue: c }, c ? `Cue set on ${v.name}` : `Cue cleared on ${v.name}`);
              }}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            />
            <LinkField key={`l${v.video ?? ""}`} className="h-[38px]" value={linkOf(v.video)} label={`${item.name} · ${v.name}`} pending={pending} onUse={(url) => patchVar(v.id, { video: url }, `Link set on ${item.name} · ${v.name}`)} onClear={() => patchVar(v.id, { video: null }, `Demo taken off ${v.name}`)} />
            <Button variant="ghost" size="icon" className="lb-bin" disabled={pending} onClick={() => onVariations(vars.filter((x) => x.id !== v.id), `${v.name} deleted`)} aria-label={`Delete ${v.name}`} title="Delete this variation">
              <TrashIcon />
            </Button>
          </div>
        ))}
        {adding != null && (
          <div className="lb-xrow sub adding">
            <i className="lb-sub-mark" aria-hidden="true" />
            <Input autoFocus className="h-[38px]" value={adding} onChange={(e) => setAdding(e.target.value)} maxLength={40} placeholder="Close grip, wide grip…" aria-label="New variation" onKeyDown={(e) => (e.key === "Enter" ? addVariation() : e.key === "Escape" ? setAdding(null) : undefined)} />
            <Button size="sm" disabled={!adding.trim()} onClick={addVariation}>
              Add
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAdding(null)}>
              Cancel
            </Button>
          </div>
        )}
      </div>
      <DialogVideos videos={videos} onChanged={onVideosChanged} onDelete={onVideoDelete} />
      {/* Demos, links, variations and their cues save as they are set; only the name, group and cue wait for Save. With nothing waiting, the button is Done. */}
      <DialogFooter>
        <span className="rd-dlg-hint grow">{pending ? "Saving…" : changed ? "Name, group or cue changed · not saved yet" : "Demos, links and variations are saved as you set them."}</span>
        {changed ? (
          <>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button disabled={!name.trim() || pending} onClick={() => onSave({ ...(name.trim() !== item.name ? { name: name.trim() } : {}), ...(group !== item.group ? { group } : {}), ...(cue.trim() !== item.cue ? { cue: cue.trim() } : {}) })}>
              Save
            </Button>
          </>
        ) : (
          <DialogClose asChild>
            <Button disabled={pending}>Done</Button>
          </DialogClose>
        )}
      </DialogFooter>
    </DialogContent>
  );
}

/** A new exercise (in the group it was started from) or cardio movement. */
function CreateDialog({ group, groupLabel, onCreate }: { group: string; groupLabel: string; onCreate: (v: { name: string; cue: string }) => void }) {
  const cardio = group === "cardio";
  const [name, setName] = useState("");
  const [cue, setCue] = useState("");
  return (
    <DialogContent className="rd-dlg">
      <DialogHeader>
        <DialogTitle>{cardio ? "New cardio movement" : `New exercise in ${groupLabel}`}</DialogTitle>
        <DialogDescription>{cardio ? "Offered when you add cardio to a session." : "Offered when you add an exercise to a session. Its demo goes on next."}</DialogDescription>
      </DialogHeader>
      <div className="lb-field">
        <Label htmlFor="lb-new-name">Name</Label>
        <Input id="lb-new-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder={cardio ? "Incline walk" : "Seated cable row"} autoFocus onKeyDown={(e) => e.key === "Enter" && name.trim() && onCreate({ name: name.trim(), cue: cue.trim() })} />
      </div>
      <div className="lb-field">
        <Label htmlFor="lb-new-cue">Default cue</Label>
        <Textarea id="lb-new-cue" rows={2} className="min-h-16" value={cue} onChange={(e) => setCue(e.target.value)} maxLength={300} placeholder={cardio ? "Keep it conversational" : "Squeeze at the top"} />
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Cancel</Button>
        </DialogClose>
        <Button disabled={!name.trim()} onClick={() => onCreate({ name: name.trim(), cue: cue.trim() })}>
          Add to library
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
