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
import { MoreIcon, PencilIcon, PlusIcon, TrashIcon } from "../../../components/icons";
import { archiveLibraryExerciseAction, assignVideoToExerciseAction, createLibraryExerciseAction, deleteLibraryVideoAction, renameLibraryVideoAction, uploadLibraryVideoAction } from "./actions";
import type { LibraryData, LibraryItem, LibraryVideo } from "./load";
import ExerciseEditorModal from "./ExerciseEditorModal";
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
  const openItem = (id: number) => setOpenId(id);
  const [openId, setOpenId] = useState<number | null>(null);
  // A substitute opened from an exercise's editor (14 Oct): the one to go back to.
  const [openFrom, setOpenFrom] = useState<{ id: number; name: string } | null>(null);
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

  const archive = (i: LibraryItem) => act(() => archiveLibraryExerciseAction(i.id, !i.archived), i.archived ? `${i.name} back in the library` : `${i.name} taken out of the library`);

  // An exercise, as a row inside its group: like an exercise inside a session.
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
          groups={data.groups}
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
        />
      )}

      {open && (
        <ExerciseEditorModal
          key={open.id}
          item={open}
          items={data.items}
          videos={data.videos}
          groups={data.groups}
          backTo={openFrom && openFrom.id !== open.id ? openFrom : null}
          onClose={() => {
            setOpenId(null);
            setOpenFrom(null);
          }}
          onOpenOther={(id) => {
            setOpenFrom(openFrom && id === openFrom.id ? null : { id: open.id, name: open.name });
            setOpenId(id);
          }}
          onChanged={() => router.refresh()}
        />
      )}

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
