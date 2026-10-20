"use client";

import Pager from "../Pager";
import { useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { deleteClientConfirmedAction, dismissHomeActionAction, saveCoachNoteAction, sendChatMessageAction, setEngagementPartsAction } from "../../../lib/actions";
import { useOpenChat } from "../ChatPanel";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../../components/ui/dropdown-menu";
import ClientCardEditor from "../../ClientCardEditor";
import { toast } from "sonner";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";
import { AccountIcon, CalendarIcon, CameraIcon, ChatIcon, CheckIcon, ChevronDownIcon, MoreIcon, PhasesIcon, ReceiptIcon, TrashIcon } from "../../../components/icons";
import type { ClientEngagement, HomeAction, OverviewInfoRow, OverviewPanel } from "../../../lib/queries";
import { MessageDialog } from "../training/TrainingDraft";
import AppAccessButton from "./AppAccessButton";
import type { NeedView } from "../loaders";
import type { ClientAccess } from "../../../lib/access-actions";
import { dayMonth } from "../../../lib/dayMonth";
import { SepJoin } from "../Sep";
import { TRACK_LABEL, TRACK_PALETTE } from "../../phaseChrome";
import type { PhaseTrack } from "../../../lib/db";
import { TrackIcon } from "../plan/PlanDraft";

// The client's Home (21 Oct, Alex: rebuilt as the track tabs are, root "rd trn rls rh"): Training's header, the six
// figures in one hairline card, then each section's title on the page over its card.
//
// - The header: face, name, how long they have been a client; App access, Details and Message as white pills, ⋯ to delete.
// - Keeping up: one score, and the behaviours it is the mean of.
// - Needs you: what is waiting on the coach, a row each, leading to the thing; Reply and ✓ on hover.
// - Activity: what they did, one kind at a time, a page at a time.
// Details is a pop-up: member info, coaching info and the coach's own note.

/** href: the thing itself (a session, a food day, an invoice), from feedHref. */
export type DraftEvent = { id: string; category: string; text: string; note: string | null; when: string; tab: string; href: string | null };
export type DraftHome = {
  name: string;
  initial: string;
  avatarPath: string | null;
  clientSince: string | null;
  snapshot: OverviewPanel["snapshot"];
  /** The whole client card, for the live editor in the Details dialog. */
  panel: OverviewPanel;
  coachNote: { text: string; savedLabel: string | null };
  actions: NeedView[];
  events: DraftEvent[];
  eventTotal: number;
  engagement: ClientEngagement;
  /** The client's login, for the App access button (read with the page: no second call). */
  access: ClientAccess;
};

const savedToast = (what: string) => toast.success("Saved", { description: what });

// The tabs' ids, as the shell names them.
const DRAFT_TAB: Record<string, string> = {
  plan: "plan",
  training: "training",
  nutrition: "nutrition",
  measurements: "measurements",
  meetings: "meetings",
  photos: "pictures",
  messages: "messages",
  invoices: "invoices",
  billing: "invoices",
};
const TONE: Record<HomeAction["tone"], { text: string; cls: string }> = { urgent: { text: "Urgent", cls: "bad" }, due: { text: "Due", cls: "warn" }, note: { text: "To read", cls: "live" } };
// The tab that deals with a Needs-you row, as a tag: a track's in its colour (design rules 3), the rest grey.
const TRACK_OF: Record<string, PhaseTrack> = { training: "training", nutrition: "nutrition", measurements: "lifestyle" };
const OTHER_TAG: Record<string, { label: string; icon: ReactNode }> = {
  meetings: { label: "Meetings", icon: <CalendarIcon /> },
  photos: { label: "Shape update", icon: <CameraIcon /> },
  messages: { label: "Chat", icon: <ChatIcon /> },
  invoices: { label: "Invoices", icon: <ReceiptIcon /> },
  plan: { label: "Plan", icon: <PhasesIcon /> },
};
// Activity is read one kind at a time; every source category has a home here.
const FILTERS = [
  // A call asked for, an event added, a note on the programme: words from the
  // client, so with the messages (12 Oct), not under Training.
  { id: "training", label: "Training", holds: ["training"] },
  { id: "nutrition", label: "Nutrition", holds: ["nutrition"] },
  { id: "measurements", label: "Lifestyle", holds: ["measurements"] },
  { id: "invoices", label: "Invoices", holds: ["billing"] },
  { id: "messages", label: "Messages", holds: ["messages", "notes"] },
] as const;
type FilterId = (typeof FILTERS)[number]["id"];
const PAGE = 12;
const tone = (pct: number) => (pct >= 80 ? "good" : pct >= 50 ? "mid" : "low");
/** A line the server writes with "a · b": its parts, for a bar between them (design rules 1). Never cut inside “…”:
    the client's own words (an event called "Trip · Rome") stay whole. */
const parts = (s: string) => {
  const out: string[] = [];
  let depth = 0;
  let from = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "“") depth++;
    else if (s[i] === "”") depth = Math.max(0, depth - 1);
    else if (depth === 0 && s.startsWith(" · ", i)) {
      out.push(s.slice(from, i));
      from = i + 3;
      i += 2;
    }
  }
  out.push(s.slice(from));
  return out.map((p) => p.trim()).filter(Boolean);
};
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
/** The card's dates as every date in words is written (design rules 7): 25/5, 12/3/1994. */
const dated = (rows: OverviewInfoRow[]) => rows.map((r) => (ISO_DAY.test(r.value) ? { ...r, value: dayMonth(r.value) } : r));

export default function HomeDraft({ clientId, firstName, home, onOpenTab }: { clientId: number; firstName: string; home: DraftHome; onOpenTab: (tab: string) => void }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  // Every save goes to the server, then the page re-reads; what is on screen follows.
  const act = (fn: () => Promise<unknown>, said?: string) =>
    startTransition(async () => {
      await fn();
      router.refresh();
      if (said) savedToast(said);
    });
  const fd = (o: Record<string, string | number | null | undefined>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(o)) if (v != null) f.set(k, String(v));
    return f;
  };
  const openChat = useOpenChat();
  const [msg, setMsg] = useState(false);
  // Message opens the chat panel on their thread, as on every tab; outside the shell, a message pop-up.
  const message = () => (openChat ? openChat() : setMsg(true));
  const [details, setDetails] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [photo, setPhoto] = useState(false);
  const panel = useMemo(() => ({ ...home.panel, memberInfo: dated(home.panel.memberInfo), coachingInfo: dated(home.panel.coachingInfo) }), [home.panel]);

  // Keeping up's pick, ahead of the server's answer, so the ticks move at once.
  const [picked, setPicked] = useState<string[] | null>(null);
  const chosenParts = picked ?? home.engagement.chosen;
  const toggleSpart = (id: string) => {
    const next = chosenParts.includes(id) ? chosenParts.filter((x) => x !== id) : [...chosenParts, id];
    if (next.length === 0) return;
    setPicked(next);
    act(() => setEngagementPartsAction(clientId, next));
  };
  const eng = home.engagement;
  const shift = eng.overall == null || eng.previous == null ? null : eng.overall - eng.previous;

  // Marked as read: gone at once, the server catching up behind.
  const [done, setDone] = useState<Set<string>>(() => new Set());
  const needs = home.actions.filter((a) => !done.has(a.id));

  const [filter, setFilter] = useState<FilterId>(FILTERS[0].id);
  const [page, setPage] = useState(1);
  const holds = FILTERS.find((f) => f.id === filter)!.holds as readonly string[];
  const matching = home.events.filter((e) => holds.includes(e.category));
  const pages = Math.max(1, Math.ceil(matching.length / PAGE));
  const at = Math.min(page, pages);
  const from = (at - 1) * PAGE;
  const shown = matching.slice(from, from + PAGE);
  const pick = (id: FilterId) => {
    setFilter(id);
    setPage(1);
  };
  const go = (e: DraftEvent) => {
    if (e.href) return router.push(e.href);
    const t = DRAFT_TAB[e.tab];
    if (t) onOpenTab(t);
  };

  const needGrid = { gridTemplateColumns: "minmax(0, 1fr) 128px 84px 92px", columnGap: 16 } as const;
  const actGrid = { gridTemplateColumns: "130px minmax(0, 1fr)", columnGap: 24 } as const;

  return (
    <div className="rd trn rls rh">
      {/* ---- Header: Training's, with the face before the name. No fact line, so no room kept for one. */}
      <header className="trn-head bare">
        <div className="trn-head-main">
          <span className="trn-eyebrow">Home</span>
          <div className="trn-name-row">
            {/* The face opens large. */}
            <button
              type="button"
              className="rh-avatar"
              onClick={() => home.avatarPath && setPhoto(true)}
              title={home.avatarPath ? "See the photo" : undefined}
              aria-label={home.avatarPath ? `${home.name}'s photo` : undefined}
              disabled={!home.avatarPath}
            >
              {home.avatarPath ? (
                // eslint-disable-next-line @next/next/no-img-element -- client-uploaded file
                <img src={home.avatarPath} alt="" />
              ) : (
                home.initial
              )}
            </button>
            <h1 className="trn-name">{home.name}</h1>
            {home.clientSince && <span className="rh-since">{home.clientSince}</span>}
          </div>
        </div>
        <div className="trn-head-actions">
          {/* White pills with an icon, as every tab's own actions (design rules 9b). */}
          <AppAccessButton key={clientId} clientId={clientId} firstName={firstName} initial={home.access} />
          <button type="button" className="trn-pill" onClick={() => setDetails(true)}>
            <AccountIcon /> Details
          </button>
          <button type="button" className="trn-pill" onClick={message}>
            <ChatIcon /> Message
          </button>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger className="trn-more" aria-label={`More for ${firstName}`}>
              <MoreIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="pb-menu">
              <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
                <TrashIcon /> Delete {firstName}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ---- The figures the coach checks first, in one hairline card. */}
      <section className="rls-card rh-figs" aria-label="At a glance">
        {home.snapshot.map((s) => (
          <div key={s.label} className="rh-fig">
            <span className="rh-fig-label">{s.label}</span>
            <b className={s.attention ? "warn" : ""}>{s.value}</b>
            {s.suffix && (
              <small>
                <SepJoin parts={parts(s.suffix)} />
              </small>
            )}
          </div>
        ))}
      </section>

      {/* ---- Keeping up: one score, the behaviours it is the mean of. */}
      {eng.options.some((o) => o.available) && (
        <section className="rls-section">
          <div className="trn-weekhead">
            <div>
              <h2>Keeping up</h2>
              <span title={eng.since ? `Counted from ${dayMonth(eng.since)}, their first day` : undefined}>Last {eng.days} days</span>
            </div>
            <div className="trn-weekhead-actions">
              {/* What counts for this client (12 Oct): the coach's pick, at least one. */}
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger className="trn-pill">
                  What counts <ChevronDownIcon />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="pb-menu">
                  <div className="rh-parts-label">Counted in {firstName}&rsquo;s score</div>
                  {eng.options.map((o) => (
                    <DropdownMenuCheckboxItem
                      key={o.id}
                      checked={chosenParts.includes(o.id)}
                      disabled={!o.available || (chosenParts.length === 1 && chosenParts.includes(o.id))}
                      onSelect={(e) => {
                        e.preventDefault();
                        toggleSpart(o.id);
                      }}
                    >
                      <span className="rh-part-opt">
                        {o.label}
                        {o.why && <small>{o.why}</small>}
                      </span>
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="rls-card rh-board">
            <div className="rh-score">
              <Dial pct={eng.overall} />
              <span className="rh-score-word">Overall</span>
              {shift != null && (
                <span className={`rh-trend ${shift > 0 ? "up" : shift < 0 ? "down" : "flat"}`}>
                  {shift === 0 ? `Level with the ${eng.days} days before` : `${shift > 0 ? "▲" : "▼"} ${Math.abs(shift)}% vs the ${eng.days} days before`}
                </span>
              )}
            </div>
            <div className="rh-parts">
              {eng.parts.map((p) => (
                <div key={p.id} className="rh-part">
                  <span className="rh-part-name">{p.label}</span>
                  <span className="rh-part-pct">{p.pct}%</span>
                  <span className="rh-part-track">
                    <span className={`rh-part-fill ${tone(p.pct)}`} style={{ width: `${Math.max(0, Math.min(100, p.pct))}%` }} />
                  </span>
                  <span className="rh-part-detail">
                    <SepJoin parts={[p.detail, p.note]} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---- Needs you: what is waiting on the coach. A click opens the thing (12 Oct); on hover, Reply opens the chat
          about it, and ✓ marks it read so it leaves. */}
      <section className="rls-section">
        <div className="trn-weekhead">
          <div>
            <h2>Needs you</h2>
            {needs.length > 0 && <span>{needs.length} open</span>}
          </div>
        </div>
        <div className="rls-card rh-card">
          {needs.length === 0 ? (
            <p className="rls-none">All clear</p>
          ) : (
            <div className="rh-rows">
              {needs.map((a) => {
                const t = TONE[a.tone];
                // The title semi-bold; the rest of it and the detail grey after it, parted by bars. The client's own words in quotes.
                const [head, ...rest] = parts(a.title);
                const grey = [...rest, ...(a.detail ? (a.quote ? [`“${a.detail}”`] : parts(a.detail)) : [])];
                return (
                  <div key={a.id} className="rls-row rh-row">
                    {/* A click anywhere opens it; for the keyboard the title is the button, the actions its siblings. */}
                    <div className="rls-row-main" style={needGrid} onClick={() => router.push(a.open)}>
                      <span className="rh-what">
                        <button type="button" className="rd-row-hit rh-what-title">
                          {head}
                        </button>
                        {grey.length > 0 && (
                          <span className={`rh-what-note${a.quote ? " quote" : ""}`}>
                            <SepJoin parts={grey} />
                          </span>
                        )}
                      </span>
                      <span>{a.tab && <TabTag tab={a.tab} />}</span>
                      <span>
                        <span className={`trn-state rh-state ${t.cls}`}>{t.text}</span>
                      </span>
                      <span className="rh-acts" onClick={(e) => e.stopPropagation()}>
                        {a.reply && openChat && (
                          <button
                            type="button"
                            className="rh-reply"
                            onClick={() => {
                              const r = a.reply!;
                              openChat(r.link ? { area: r.area, label: r.label, link: r.link } : null, r.focus);
                            }}
                          >
                            Reply
                          </button>
                        )}
                        <button
                          type="button"
                          className="trn-row-more rh-done"
                          onClick={() => {
                            setDone((d) => new Set(d).add(a.id));
                            act(() => dismissHomeActionAction(clientId, a.id));
                          }}
                          aria-label="Mark as read"
                          title="Mark as read"
                        >
                          <CheckIcon />
                        </button>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ---- Activity: what they did, one kind at a time. A log (design rules 8): the date the light part, the thing
          semi-bold, the rest in grey after it on the one line. A row opens the thing on its tab. */}
      <section className="rls-section">
        <div className="trn-weekhead">
          <div>
            <h2>Activity</h2>
          </div>
          <div className="trn-weekhead-actions">
            <div className="rd-btn-group" role="group" aria-label="Which kind">
              {FILTERS.map((f) => (
                <button key={f.id} type="button" className={filter === f.id ? "on" : ""} aria-pressed={filter === f.id} onClick={() => pick(f.id)}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="rls-card rh-card">
          {shown.length === 0 ? (
            <p className="rls-none">None yet</p>
          ) : (
            <div className="rh-rows">
              {shown.map((e) => {
                const [head, ...rest] = parts(e.text.charAt(0).toUpperCase() + e.text.slice(1));
                return (
                  <div key={e.id} className="rls-row rh-row">
                    <div className="rls-row-main" style={actGrid} onClick={() => go(e)}>
                      <span className="rh-when">
                        <SepJoin parts={parts(e.when)} />
                      </span>
                      <span className="rh-what">
                        <button type="button" className="rd-row-hit rh-what-title">
                          {head}
                        </button>
                        {(rest.length > 0 || e.note) && (
                          <span className="rh-what-note">
                            <SepJoin parts={[...rest, e.note ? `“${e.note}”` : null]} />
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <Pager className="rh-foot" page={at} pages={pages} from={from} shown={shown.length} total={matching.length} label="Activity pages" onPage={setPage} />
        </div>
      </section>

      {/* ---- Details: the card and the coach's note. Non-modal: the card's Edit opens its form in a layer of its own,
          which a modal dialog would lock out. */}
      {/* Non-modal draws no scrim of its own: the page dims behind it as behind every pop-up; a click on it closes Details. */}
      {details && createPortal(<div className="rh-scrim" aria-hidden="true" />, document.body)}
      <Dialog open={details} modal={false} onOpenChange={(o) => !o && setDetails(false)}>
        {details && (
          <DialogContent
            className="dlh rh-details"
            // Focus on the card itself (no ring on a button), so the next Tab goes on inside it, not to the page.
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              (e.currentTarget as HTMLElement).focus({ preventScroll: true });
            }}
            // Esc in the card's own edit pop-up closes that alone, not Details with it.
            onEscapeKeyDown={(e) => {
              if (document.querySelector(".cc-dialog")) e.preventDefault();
            }}
          >
            <div className="dlh-head">
              <DialogTitle className="dlh-title">{home.name}</DialogTitle>
              <DialogClose className="dlh-x" aria-label="Close">
                ✕
              </DialogClose>
            </div>
            <DialogDescription className="sr-only">Member info, coaching info and your note about {firstName}</DialogDescription>
            <div className="rh-details-body">
              <ClientCardEditor clientId={clientId} panel={panel} chrome="rail" look="hairline" />
              <CoachNote text={home.coachNote.text} savedLabel={home.coachNote.savedLabel} onSave={(v) => act(() => saveCoachNoteAction(clientId, v), "Coach note")} />
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* Deleting: what goes, and their name typed to be sure. */}
      <Dialog open={deleting} onOpenChange={(o) => !o && setDeleting(false)}>
        {deleting && <DeleteClientDialog clientId={clientId} name={home.name} firstName={firstName} />}
      </Dialog>

      {/* The photo, large. */}
      <Dialog open={photo} onOpenChange={(o) => !o && setPhoto(false)}>
        {photo && home.avatarPath && (
          <DialogContent className="dlh rh-photodlg">
            <div className="dlh-head">
              <DialogTitle className="dlh-title">{home.name}</DialogTitle>
              <DialogClose className="dlh-x" aria-label="Close">
                ✕
              </DialogClose>
            </div>
            <DialogDescription className="sr-only">{home.name}&rsquo;s profile photo</DialogDescription>
            {/* eslint-disable-next-line @next/next/no-img-element -- client-uploaded file */}
            <img className="rh-photo" src={home.avatarPath} alt={`${home.name}'s photo`} />
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={msg} onOpenChange={(o) => !o && setMsg(false)}>
        {msg && (
          <MessageDialog
            firstName={firstName}
            label="Home"
            onSend={(text) => {
              setMsg(false);
              act(() => sendChatMessageAction(fd({ clientId, text })), `Message to ${firstName}`);
            }}
          />
        )}
      </Dialog>
    </div>
  );
}

/** The tab that deals with a Needs-you row: a track's tag in its colour, the rest grey; one width down the column. */
function TabTag({ tab }: { tab: string }) {
  const track = TRACK_OF[tab];
  if (track)
    return (
      <span className="rh-tag" style={{ color: TRACK_PALETTE[track].ink, background: TRACK_PALETTE[track].tint }}>
        <TrackIcon track={track} size={12} />
        {TRACK_LABEL[track]}
      </span>
    );
  const o = OTHER_TAG[tab];
  if (!o) return null;
  return (
    <span className="rh-tag grey">
      {o.icon}
      {o.label}
    </span>
  );
}

// The overall, as one dial.
const STROKE = 7;
const SIZE = 112;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;
/** null: nothing to count yet (what the coach picked can't be counted for this client): an empty ring and a dash, no colour. */
function Dial({ pct }: { pct: number | null }) {
  const filled = pct == null ? 0 : (Math.max(0, Math.min(100, pct)) / 100) * C;
  return (
    <div className="rh-dial" style={{ width: SIZE, height: SIZE }}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} aria-hidden="true">
        <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="#eef0f3" strokeWidth={STROKE} />
          <circle
            className={`rh-dial-arc${pct == null ? "" : ` ${tone(pct)}`}`}
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeOpacity={filled > 0.5 ? 1 : 0}
            style={{ strokeDasharray: `${filled} ${C}` }}
          />
        </g>
      </svg>
      <span className={`rh-dial-figure${pct == null ? " none" : ""}`}>
        {pct == null ? (
          "–"
        ) : (
          <>
            {Math.round(pct)}
            <small>%</small>
          </>
        )}
      </span>
    </div>
  );
}

// The coach's own note, theirs alone: a note that saves (design rules 4). No line until something is typed; then the
// line, Cancel and Save.
function CoachNote({ text, savedLabel, onSave }: { text: string; savedLabel: string | null; onSave: (text: string) => void }) {
  const [saved, setSaved] = useState(text);
  const [draft, setDraft] = useState(text);
  const typed = draft.trim() !== saved.trim();
  return (
    <section className="rh-note">
      <span className="dlh-label">
        <SepJoin parts={["Coach note", savedLabel && saved ? savedLabel : null]} />
      </span>
      <textarea className={`rh-note-text${typed ? " typed" : ""}`} value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} placeholder="Add a note" aria-label="Coach note" />
      {typed && (
        <div className="rh-note-foot">
          <button type="button" className="dlh-cancel" onClick={() => setDraft(saved)}>
            Cancel
          </button>
          <button
            type="button"
            className="dlh-go"
            onClick={() => {
              setSaved(draft.trim());
              setDraft(draft.trim());
              onSave(draft.trim());
            }}
          >
            Save
          </button>
        </div>
      )}
    </section>
  );
}

// ---- Delete a client: everything of theirs goes, their invoices stay. Their name typed to be sure.
function DeleteClientDialog({ clientId, name, firstName }: { clientId: number; name: string; firstName: string }) {
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const ok = typed.trim().toLowerCase() === name.trim().toLowerCase();
  // Opened from the ⋯ menu: the field takes the keyboard a beat after the dialog's own focus move (as DeleteSessionDialog).
  const field = useRef<HTMLInputElement>(null);
  const go = () =>
    start(async () => {
      const err = await deleteClientConfirmedAction(clientId, typed);
      if (err) return setError(err);
      toast.success(`${name} deleted`);
      router.push("/admin/redesign/feed");
    });
  return (
    <DialogContent
      className="dlh"
      onOpenAutoFocus={(e) => {
        e.preventDefault();
        setTimeout(() => field.current?.focus(), 60);
      }}
    >
      <div className="dlh-head">
        <DialogTitle className="dlh-title">Delete {name}?</DialogTitle>
        <DialogClose className="dlh-x" aria-label="Close">
          ✕
        </DialogClose>
      </div>
      <DialogDescription className="dlh-note">
        This permanently deletes {firstName}&rsquo;s login, programmes, logged sets, check-ins, photos, meetings and chat. It can&rsquo;t be undone. Their invoices stay.
      </DialogDescription>
      <label className="rh-field">
        <span className="dlh-label">Type their name</span>
        <input
          className="dlh-line"
          value={typed}
          onChange={(e) => {
            setTyped(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && ok && !busy && go()}
          placeholder={name}
          ref={field}
          autoComplete="off"
        />
      </label>
      {error && <p className="dlh-error">{error}</p>}
      <div className="dlh-foot">
        <DialogClose className="dlh-cancel" disabled={busy}>
          Cancel
        </DialogClose>
        <button type="button" className="dlh-delete" onClick={go} disabled={!ok || busy}>
          {busy ? "Deleting…" : "Delete"}
        </button>
      </div>
    </DialogContent>
  );
}
