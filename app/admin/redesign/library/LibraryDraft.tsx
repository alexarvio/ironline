"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Toaster } from "../../../components/ui/toast";
import { Dialog } from "../../../components/ui/dialog";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "../../../components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "../../../components/ui/dropdown-menu";
import { ArrowRightIcon, EyeIcon, MoreIcon, PencilIcon, PlusIcon, SearchIcon, TrashIcon } from "../../../components/icons";
import { setExerciseDemoLinkAction } from "../../../lib/actions";
import { archiveLibraryExerciseAction, assignVideoToExerciseAction, createLibraryExerciseAction, createLibraryGroupAction, renameLibraryGroupAction, updateLibraryExerciseAction, uploadLibraryVideoAction } from "./actions";
import type { LibraryData, LibraryItem } from "./load";
import { Fold } from "../Fold";
import Picker from "../Picker";
import DemoVideoDialog from "../training/DemoVideoDialog";
import { ConfirmDialog } from "../training/TrainingDraft";

// The coach's Library (21 Oct, Alex: "just the library for now"): every exercise of theirs and its demo, nothing else.
// Training's header (Library, + Exercise, ⋯), one search bar, then each muscle group in the coach's order (Cardio
// among them, Other last): its title with the count and the fold, then a grid of cards, an exercise a card A–Z
// (23 Oct, Alex: the rows' thumbs were way too small). A card: the demo big on top at 3:4 (a click plays it in a
// player floating by the card, or opens the link; Add video on a dashed stage when there is none), the
// name under it, Replace / Remove on hover, and ⋯ over the poster's corner (Move to, Take out; the name renames on a click); + Exercise
// the grid's last tile. Variations, substitutes and default cues are not on this screen; their data stays (Training
// and the client app use them). A change shows at once and saves behind it.

type Patch = Partial<Pick<LibraryItem, "name" | "group" | "video" | "archived">>;
/** An exercise as a card; a new one is there (faded) before the server gives it its id. */
type Row = { key: string; id: number; name: string; group: string; video: string | null; archived: boolean; pending: boolean };
type Dlg = { kind: "demo"; id: number; tab?: "link" | "file" } | { kind: "remove"; id: number } | { kind: "takeout"; id: number } | null;

/** The groups the coach opened in this browser; every other one is folded (23 Oct, Alex: folded by default). */
const OPEN_KEY = "norcoach:library-open";
// What uploadLibraryVideoAction takes (serverActions.bodySizeLimit).
const MAX_UPLOAD = 128 * 1024 * 1024;
const ytId = (url: string) => /(?:youtu\.be\/|[?&]v=|shorts\/|embed\/)([\w-]{11})/.exec(url)?.[1] ?? null;
const isUpload = (url: string) => url.startsWith("/uploads/") || /\.(mp4|mov|m4v|webm)(\?|$)/i.test(url);
/** A clip of the coach's, a YouTube video (both play by the card), or another link (opens in a new tab). */
const demoKind = (url: string): "upload" | "youtube" | "link" => (isUpload(url) ? "upload" : ytId(url) ? "youtube" : "link");
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

const readOpened = (): string[] => {
  try {
    const v: unknown = JSON.parse(window.localStorage.getItem(OPEN_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};
const writeOpened = (v: string[]) => {
  try {
    window.localStorage.setItem(OPEN_KEY, JSON.stringify(v));
  } catch {}
};

/** What the server now shows needs no stand-in: each patch keeps only the fields the server doesn't have yet. */
function prune(patches: Record<number, Patch>, items: LibraryItem[]): Record<number, Patch> {
  const next: Record<number, Patch> = {};
  for (const [key, p] of Object.entries(patches)) {
    const item = items.find((i) => i.id === Number(key));
    if (!item) continue;
    const left: Record<string, unknown> = {};
    for (const f of Object.keys(p) as (keyof Patch)[]) if (p[f] !== item[f]) left[f] = p[f];
    if (Object.keys(left).length) next[Number(key)] = left as Patch;
  }
  return next;
}

export default function LibraryDraft({ data }: { data: LibraryData }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [showOut, setShowOut] = useState(false);
  const [opened, setOpened] = useState<string[]>([]);
  // ?edit=<id> (the old drawer's link): its group open, the card scrolled to.
  const [landing, setLanding] = useState<number | null>(null);
  const [patches, setPatches] = useState<Record<number, Patch>>({});
  const [adding, setAdding] = useState<{ key: string; name: string; group: string; id: number | null }[]>([]);
  const [renaming, setRenaming] = useState<number | null>(null);
  // A group's name typed in place: a click on it (23 Oct, Alex: no Rename word); shown at once, saved behind.
  const [renamingGroup, setRenamingGroup] = useState<string | null>(null);
  const [groupNames, setGroupNames] = useState<Record<string, string>>({});
  const renameGroup = (slug: string, was: string, typed: string) => {
    setRenamingGroup(null);
    const label = typed.trim().slice(0, 40);
    if (!label || label === was) return;
    setGroupNames((g) => ({ ...g, [slug]: label }));
    void save(
      () => renameLibraryGroupAction(slug, label),
      () =>
        setGroupNames((g) => {
          const next = { ...g };
          delete next[slug];
          return next;
        })
    );
  };
  const [playing, setPlaying] = useState<number | null>(null);
  const [dlg, setDlg] = useState<Dlg>(null);
  // The floating create panel that is open: "head" (+ Exercise), "group" (New group), or a group's slug (its card's + Exercise).
  const [panel, setPanel] = useState<string | null>(null);
  // A menu item that hands the focus on (Rename, New group): the menu doesn't take it back to ⋯ as it closes.
  const keepFocus = useRef(false);

  // New data from the server: the stand-ins it now matches go.
  const [seen, setSeen] = useState(data);
  if (seen !== data) {
    setSeen(data);
    setPatches((p) => prune(p, data.items));
    setAdding((a) => a.filter((x) => x.id == null || !data.items.some((i) => i.id === x.id)));
  }

  // The folds as the coach left them in this browser, and ?edit=<id>, once the page is on screen.
  useEffect(() => {
    const t = setTimeout(() => {
      setOpened(readOpened());
      const edit = Number(new URLSearchParams(window.location.search).get("edit"));
      if (edit > 0) {
        setLanding(edit);
        const url = new URL(window.location.href);
        url.searchParams.delete("edit");
        window.history.replaceState(null, "", url.toString());
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (landing == null) return;
    const f = requestAnimationFrame(() => document.querySelector(`[data-exercise-id="${landing}"]`)?.scrollIntoView({ block: "center" }));
    return () => cancelAnimationFrame(f);
  }, [landing]);

  const items = data.items.map((i) => ({ ...i, ...patches[i.id] }));
  const itemOf = (id: number) => items.find((i) => i.id === id) ?? null;
  const known = new Set(data.items.map((i) => i.id));
  const slugs = new Set(data.groups.map((g) => g.slug));
  const rows: Row[] = [
    ...items.map((i) => ({ key: `e${i.id}`, id: i.id, name: i.name, group: slugs.has(i.group) ? i.group : "other", video: i.video, archived: i.archived, pending: false })),
    ...adding.filter((a) => a.id == null || !known.has(a.id)).map((a) => ({ key: a.key, id: a.id ?? 0, name: a.name, group: a.group, video: null, archived: false, pending: true })),
  ];
  const outCount = items.filter((i) => i.archived).length;
  const needle = q.trim().toLowerCase();
  // A link to one that is taken out still lands on it (that card alone shows, greyed).
  const shown = rows.filter((r) => (showOut || !r.archived || (!r.pending && r.id === landing)) && (!needle || r.name.toLowerCase().includes(needle)));
  const sections = data.groups.map((g) => ({ ...g, rows: shown.filter((r) => r.group === g.slug).sort(byName) })).filter((s) => !needle || s.rows.length > 0);
  const landingGroup = landing != null ? (rows.find((r) => !r.pending && r.id === landing)?.group ?? null) : null;
  const isOpen = (slug: string) => !!needle || slug === landingGroup || opened.includes(slug);

  const setOpens = (next: string[]) => {
    setOpened(next);
    writeOpened(next);
  };
  const toggle = (slug: string) => {
    const open = isOpen(slug);
    if (slug === landingGroup) setLanding(null);
    // One group open at a time (23 Oct, Alex): opening one folds the one that was open.
    setOpens(open ? [] : [slug]);
  };

  const patch = (id: number, p: Patch) => setPatches((all) => ({ ...all, [id]: { ...all[id], ...p } }));
  const unpatch = (id: number, field: keyof Patch) =>
    setPatches((all) => {
      const rest = { ...all[id] };
      delete rest[field];
      return { ...all, [id]: rest };
    });
  /** Saves behind a change that already shows; a refusal puts it back and says so. */
  // True once saved; false after undoing the change on screen and saying so.
  const save = async (job: () => Promise<unknown>, undo: () => void): Promise<boolean> => {
    try {
      if ((await job()) === false) throw new Error("refused");
      router.refresh();
      return true;
    } catch {
      undo();
      toast.error("Not saved. Try again.");
      return false;
    }
  };

  const rename = (it: Row, typed: string) => {
    setRenaming(null);
    const name = typed.trim().slice(0, 60);
    if (!name || name === it.name) return;
    patch(it.id, { name });
    void save(() => updateLibraryExerciseAction(it.id, { name }), () => unpatch(it.id, "name"));
  };
  const moveTo = (it: Row, group: string) => {
    patch(it.id, { group });
    void save(() => updateLibraryExerciseAction(it.id, { group }), () => unpatch(it.id, "group"));
  };
  const takeOut = (it: { id: number }, archived: boolean) => {
    patch(it.id, { archived });
    void save(() => archiveLibraryExerciseAction(it.id, archived), () => unpatch(it.id, "archived"));
  };
  // Throws when it didn't save, so the demo dialog keeps showing the demo (it clears only on success).
  const removeDemo = async (it: { id: number }) => {
    patch(it.id, { video: null });
    if (!(await save(() => assignVideoToExerciseAction(it.id, null), () => unpatch(it.id, "video")))) throw new Error("not saved");
  };
  // The demo dialog's ways in: a link, one of the coach's own clips (Your videos: handed over by its id, the link
  // action takes only http links), or a file into the coach's videos and onto the exercise (as the old editor did).
  const setLink = async (it: { id: number }, url: string) => {
    const clip = data.videos.find((v) => v.path === url);
    if (clip) {
      if (!(await assignVideoToExerciseAction(it.id, clip.id))) throw new Error("refused");
    } else {
      const f = new FormData();
      f.set("exerciseId", String(it.id));
      f.set("demoUrl", url);
      const err = await setExerciseDemoLinkAction(f);
      if (err) throw new Error(err);
    }
    patch(it.id, { video: url });
    setDlg(null);
    router.refresh();
  };
  const upload = async (it: { id: number }, file: File) => {
    if (file.size > MAX_UPLOAD) throw new Error(`${Math.round(file.size / 1024 / 1024)} MB is over 128 MB`);
    const f = new FormData();
    f.set("file", file);
    const r = await uploadLibraryVideoAction(f);
    if (!r.ok) throw new Error(r.error);
    if (!(await assignVideoToExerciseAction(it.id, r.id))) throw new Error("it didn’t go through");
    setDlg(null);
    router.refresh();
  };
  const addExercise = (name: string, group: string) => {
    const key = `new-${Date.now()}`;
    setPanel(null);
    setAdding((a) => [...a, { key, name, group, id: null }]);
    if (!opened.includes(group)) setOpens([group]);
    void (async () => {
      const id = await createLibraryExerciseAction(name, group, "").catch(() => null);
      if (id == null) {
        setAdding((a) => a.filter((x) => x.key !== key));
        toast.error("Not saved. Try again.");
        return;
      }
      setAdding((a) => a.map((x) => (x.key === key ? { ...x, id } : x)));
      router.refresh();
    })();
  };
  const addGroup = async (label: string) => {
    const slug = await createLibraryGroupAction(label).catch(() => null);
    if (!slug) {
      toast.error("Not saved. Try again.");
      return;
    }
    setPanel(null);
    router.refresh();
  };

  // A name already in the library, where it is.
  const exerciseTaken = (name: string) => {
    const n = name.trim().toLowerCase();
    const hit = n ? rows.find((r) => r.name.trim().toLowerCase() === n) : null;
    if (!hit) return null;
    return hit.archived ? `${hit.name} is taken out.` : `${hit.name} is already in ${data.groups.find((g) => g.slug === hit.group)?.label ?? "Other"}.`;
  };
  const groupTaken = (label: string) => {
    const n = label.trim().toLowerCase();
    const hit = n ? data.groups.find((g) => g.label.toLowerCase() === n) : null;
    return hit ? `${hit.label} is already a group.` : null;
  };
  const groupOptions = data.groups.map((g) => ({ value: g.slug, label: g.label }));
  const dlgItem = dlg ? itemOf(dlg.id) : null;

  const tileView = (r: Row) => {
    const kind = r.video ? demoKind(r.video) : null;
    const stage = kind == null ? `none${r.pending || r.archived ? " off" : ""}` : kind === "link" ? "link" : "poster";
    return (
      <div key={r.key} data-exercise-id={r.pending ? undefined : r.id} className={`lbx-tile${r.archived ? " out" : ""}${r.pending ? " pending" : ""}`}>
        <div className={`lbx-stage ${stage}`}>
          <Demo row={r} playing={playing === r.id} onPlay={(on) => setPlaying(on ? r.id : null)} onAdd={(tab) => setDlg({ kind: "demo", id: r.id, tab })} />
          {!r.pending && !r.archived && (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger className="lbx-tile-more" aria-label={`More for ${r.name}`}>
                <MoreIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="pb-menu"
                onCloseAutoFocus={(e) => {
                  if (!keepFocus.current) return;
                  keepFocus.current = false;
                  e.preventDefault();
                }}
              >
                {/* The video's own actions here (23 Oct, Alex: no words under the name): Edit opens the demo pop-up, Delete asks first. */}
                {r.video && (
                  <>
                    <DropdownMenuItem onSelect={() => setDlg({ kind: "demo", id: r.id })}>
                      <PencilIcon /> Edit video
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onSelect={() => setDlg({ kind: "remove", id: r.id })}>
                      <TrashIcon /> Delete video
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <ArrowRightIcon /> Move to
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="pb-menu">
                    {data.groups
                      .filter((g) => g.slug !== r.group)
                      .map((g) => (
                        <DropdownMenuItem key={g.slug} onSelect={() => moveTo(r, g.slug)}>
                          {g.label}
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setDlg({ kind: "takeout", id: r.id })}>
                  <TrashIcon /> Take out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <div className="lbx-tile-foot">
          {renaming === r.id ? (
            <RenameField name={r.name} onDone={(v) => rename(r, v)} onCancel={() => setRenaming(null)} />
          ) : r.pending || r.archived ? (
            <span className="lbx-name" title={r.name}>
              {r.name}
            </span>
          ) : (
            // A click on the name types a new one (23 Oct, Alex), as a phase's name on Training.
            <button type="button" className="lbx-name lbx-name-btn" title={r.name} aria-label={`${r.name}: rename`} onClick={() => setRenaming(r.id)}>
              {r.name}
            </button>
          )}
          <span className="lbx-acts">
            {r.pending ? null : r.archived ? (
              <button type="button" className="lbx-act" onClick={() => takeOut(r, false)}>
                Put back
              </button>
            ) : null}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="rd trn rls lbx">
      {/* ---- Header: Training's, bare (no fact line, so no room kept for one). */}
      <header className="trn-head bare">
        <div className="trn-head-main">
          <div className="trn-name-row">
            <h1 className="trn-name">Library</h1>
          </div>
        </div>
        <div className="trn-head-actions">
          <Popover open={panel === "head"} onOpenChange={(o) => setPanel(o ? "head" : null)}>
            <PopoverTrigger asChild>
              <button type="button" className={`trn-pill${panel === "head" ? " on" : ""}`}>
                <PlusIcon /> Exercise
              </button>
            </PopoverTrigger>
            {panel === "head" && <CreatePanel label="New exercise" align="end" groups={groupOptions} group={data.groups[0]?.slug ?? "other"} taken={exerciseTaken} onAdd={addExercise} onCancel={() => setPanel(null)} />}
          </Popover>
          <Popover open={panel === "group"} onOpenChange={(o) => !o && setPanel(null)}>
            <PopoverAnchor asChild>
              <span className="lbx-more">
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger className="trn-more" aria-label="More for the library">
                    <MoreIcon />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="pb-menu"
                    onCloseAutoFocus={(e) => {
                      if (!keepFocus.current) return;
                      keepFocus.current = false;
                      e.preventDefault();
                    }}
                  >
                    <DropdownMenuItem
                      onSelect={() => {
                        keepFocus.current = true;
                        setPanel("group");
                      }}
                    >
                      <PlusIcon /> New group
                    </DropdownMenuItem>
                    {(outCount > 0 || showOut) && (
                      <DropdownMenuItem onSelect={() => setShowOut((v) => !v)}>
                        <EyeIcon /> {showOut ? "Hide taken out" : "Show taken out"}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </span>
            </PopoverAnchor>
            {panel === "group" && <CreatePanel label="New group" align="end" taken={groupTaken} onAdd={(label) => addGroup(label)} onCancel={() => setPanel(null)} />}
          </Popover>
        </div>
      </header>

      {/* ---- One search: by name, every group at once. */}
      <div className="lbx-find">
        <label className="lbx-search">
          <SearchIcon />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setQ("");
            }}
            placeholder="Search exercises"
            aria-label="Search the library"
          />
        </label>
        {needle && sections.length === 0 && <p className="lbx-none">None</p>}
      </div>

      {/* ---- A muscle group: its title, the count and the fold; a grid of cards, A–Z; + Exercise the last tile. */}
      {sections.map((s) => {
        const open = isOpen(s.slug);
        const count = s.rows.filter((r) => !r.archived).length;
        const label = groupNames[s.slug] ?? s.label;
        const fold = (
          <>
            <small>{count}</small>
            <Fold open={open} />
          </>
        );
        return (
          <section key={s.slug} className="rls-section lbx-group" aria-label={label}>
            <h2 className="lbx-gtitle">
              {renamingGroup === s.slug ? (
                <input
                  className="lbx-grename"
                  defaultValue={label}
                  autoFocus
                  maxLength={40}
                  aria-label={`Rename ${label}`}
                  onFocus={(e) => e.currentTarget.select()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") renameGroup(s.slug, label, e.currentTarget.value);
                    if (e.key === "Escape") setRenamingGroup(null);
                  }}
                  onBlur={(e) => renameGroup(s.slug, label, e.currentTarget.value)}
                />
              ) : (
                // A click on the name types a new one (23 Oct, Alex: no Rename word beside it).
                <button type="button" className="lbx-glabel lbx-glabel-btn" title="Rename" aria-label={`${label}: rename`} onClick={() => setRenamingGroup(s.slug)}>
                  {label}
                </button>
              )}
              {needle ? (
                <span className="lbx-gbtn">{fold}</span>
              ) : (
                <button type="button" className="lbx-gbtn" aria-expanded={open} aria-label={open ? `Fold ${label}` : `Open ${label}`} onClick={() => toggle(s.slug)}>
                  {fold}
                </button>
              )}
            </h2>
            {open && (
              <div className="lbx-grid">
                {s.rows.map(tileView)}
                {!needle && (
                  <Popover open={panel === s.slug} onOpenChange={(o) => setPanel(o ? s.slug : null)}>
                    <PopoverTrigger asChild>
                      <button type="button" className="lbx-addtile">
                        <PlusIcon />
                        <span>Exercise</span>
                      </button>
                    </PopoverTrigger>
                    {panel === s.slug && <CreatePanel label="New exercise" side="right" align="start" group={s.slug} taken={exerciseTaken} onAdd={addExercise} onCancel={() => setPanel(null)} />}
                  </Popover>
                )}
              </div>
            )}
          </section>
        );
      })}

      <Dialog open={dlg != null && dlgItem != null} onOpenChange={(o) => !o && setDlg(null)}>
        {dlg?.kind === "demo" && dlgItem && (
          <DemoVideoDialog
            key={dlgItem.id}
            startTab={dlg.tab}
            exerciseName={dlgItem.name}
            clientsUsing={0}
            current={dlgItem.video ? { url: dlgItem.video, source: "library" } : null}
            videos={data.videos}
            onClose={() => setDlg(null)}
            onLink={(url) => setLink(dlgItem, url)}
            onUpload={(file) => upload(dlgItem, file)}
            onRemove={() => removeDemo(dlgItem)}
          />
        )}
        {dlg?.kind === "remove" && dlgItem && (
          <ConfirmDialog
            title="Remove the demo?"
            description={`It comes off ${dlgItem.name} for every client.`}
            confirm="Remove"
            danger
            onConfirm={() => {
              setDlg(null);
              // A failure is already undone on screen and said in a toast.
              removeDemo(dlgItem).catch(() => {});
            }}
          />
        )}
        {dlg?.kind === "takeout" && dlgItem && (
          <ConfirmDialog
            title={`Take out ${dlgItem.name}?`}
            description="Programmes that have it keep it."
            confirm="Take out"
            danger
            onConfirm={() => {
              setDlg(null);
              takeOut(dlgItem, true);
            }}
          />
        )}
      </Dialog>

      <Toaster />
    </div>
  );
}

const PLAY = "M8 5v14l11-7z";

/** A demo clip's first frame, fetched only once its card comes near the screen. */
function LazyClip({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        setNear(true);
        io.disconnect();
      },
      { rootMargin: "400px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <video ref={ref} src={near ? `${src}#t=0.5` : undefined} preload="metadata" muted playsInline tabIndex={-1} aria-hidden="true" />;
}

/**
 * The card's stage, its demo big at 3:4: a poster for a clip or a YouTube link (a click plays it in a player floating
 * by the card; Esc or a click away closes it), the link mark for another link (opens it in a new tab), and with none
 * a + and Add video (23 Oct, Alex: no Add link on the card; the pop-up has the link tab), a + alone while it is new or
 * taken out.
 */
function Demo({ row, playing, onPlay, onAdd }: { row: Row; playing: boolean; onPlay: (on: boolean) => void; onAdd: (tab: "file" | "link") => void }) {
  const url = row.video;
  if (!url)
    return row.pending || row.archived ? (
      <span className="lbx-stage-plus" aria-hidden="true">
        <PlusIcon />
      </span>
    ) : (
      <button type="button" className="lbx-stage-add" aria-label={`Add video to ${row.name}`} onClick={() => onAdd("file")}>
        <span className="lbx-stage-plus" aria-hidden="true">
          <PlusIcon />
        </span>
        <span className="lbx-stage-word">Add video</span>
      </button>
    );
  const kind = demoKind(url);
  if (kind === "link")
    return (
      <a className="lbx-stage-hit" href={url} target="_blank" rel="noopener noreferrer" aria-label={`Open the demo of ${row.name}`} title={url}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
        </svg>
      </a>
    );
  const yt = kind === "youtube" ? ytId(url) : null;
  const tall = kind === "youtube" && /shorts\//i.test(url);
  return (
    <Popover open={playing} onOpenChange={onPlay}>
      <PopoverTrigger asChild>
        <button type="button" className="lbx-stage-hit" aria-label={`Play the demo of ${row.name}`}>
          {yt ? (
            // eslint-disable-next-line @next/next/no-img-element -- YouTube's own thumbnail
            <img src={`https://i.ytimg.com/vi/${yt}/hqdefault.jpg`} alt="" loading="lazy" draggable={false} />
          ) : (
            <LazyClip src={url} />
          )}
          <svg className="lbx-play" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d={PLAY} />
          </svg>
        </button>
      </PopoverTrigger>
      {playing && (
        <PopoverContent className={`lbx-player${tall ? " tall" : ""}`} side="right" align="start" sideOffset={10} aria-label={`${row.name} demo`} onOpenAutoFocus={(e) => e.preventDefault()}>
          {yt ? <iframe src={`https://www.youtube.com/embed/${yt}?autoplay=1&rel=0`} title={`${row.name} demo`} allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowFullScreen /> : <video src={url} controls autoPlay playsInline />}
        </PopoverContent>
      )}
    </Popover>
  );
}

/** The name typed in place: Enter or a click away keeps it (it shows at once), Esc leaves it. */
function RenameField({ name, onDone, onCancel }: { name: string; onDone: (v: string) => void; onCancel: () => void }) {
  const box = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useEffect(() => {
    const f = requestAnimationFrame(() => {
      box.current?.focus({ preventScroll: true });
      box.current?.select();
    });
    return () => cancelAnimationFrame(f);
  }, []);
  const finish = (v: string | null) => {
    if (done.current) return;
    done.current = true;
    if (v == null) onCancel();
    else onDone(v);
  };
  return (
    <input
      ref={box}
      className="lbx-rename"
      defaultValue={name}
      maxLength={60}
      aria-label="Name"
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          finish(e.currentTarget.value);
        }
        if (e.key === "Escape") {
          e.preventDefault();
          finish(null);
        }
      }}
      onBlur={(e) => finish(e.currentTarget.value)}
    />
  );
}

/**
 * The floating create panel (design rules 6): a small-caps label, the name on a clean line (and the group, from the
 * header's + Exercise), Cancel in words and an ink Add. A name already there holds Add back and says where it is.
 */
function CreatePanel({ label, side = "bottom", align, groups, group: startGroup, taken, onAdd, onCancel }: { label: string; side?: "bottom" | "right"; align: "start" | "end"; groups?: { value: string; label: string }[]; group?: string; taken: (name: string) => string | null; onAdd: (name: string, group: string) => void | Promise<void>; onCancel: () => void }) {
  const box = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [group, setGroup] = useState(startGroup ?? "other");
  const [busy, setBusy] = useState(false);
  const clash = taken(name);
  const ok = name.trim().length > 0 && !clash && !busy;
  const go = async () => {
    if (!ok) return;
    setBusy(true);
    await onAdd(name.trim().slice(0, 60), group);
    setBusy(false);
  };
  return (
    <PopoverContent
      className="rd-addpop lbx-create"
      side={side}
      align={align}
      sideOffset={side === "right" ? 10 : 6}
      onOpenAutoFocus={(e) => {
        e.preventDefault();
        box.current?.focus({ preventScroll: true });
      }}
      // The group's list floats outside the panel; a pick in it doesn't close the panel.
      onInteractOutside={(e) => {
        if ((e.target as Element | null)?.closest?.('[data-slot="dropdown-menu-content"]')) e.preventDefault();
      }}
    >
      <div
        className="rd-addpop-create"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
            e.preventDefault();
            void go();
          }
        }}
      >
        <span className="rd-addpop-label">{label}</span>
        <div className="rd-addpop-row">
          <input ref={box} value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" maxLength={60} aria-label="Name" />
        </div>
        {groups && (
          <div className="rd-addpop-row fill">
            <Picker value={group} onChange={setGroup} label="Group" options={groups} />
          </div>
        )}
        {clash && <p className="rd-addpop-warn">{clash}</p>}
        <div className="rd-addpop-foot">
          <button type="button" className="rd-addpop-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="rd-addpop-go" disabled={!ok} onClick={() => void go()}>
            Add
          </button>
        </div>
      </div>
    </PopoverContent>
  );
}
