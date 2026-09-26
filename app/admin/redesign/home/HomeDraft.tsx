"use client";

import Pager from "../Pager";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveCoachNoteAction, sendChatMessageAction } from "../../../lib/actions";
import ClientCardEditor from "../../ClientCardEditor";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { AccountIcon, ChatIcon } from "../../../components/icons";
import type { ClientEngagement, HomeAction, OverviewPanel } from "../../../lib/queries";
import { MessageDialog } from "../training/TrainingDraft";

// The calmer Home tab, as a draft on real data, in the Training draft's
// sheet. Where the coach lands for a client: who this is and where they are,
// then what needs the coach and what the client has been doing, with the
// facts about them on a rail beside it.
//
// - The top: face, name, and the six figures the coach checks first.
// - Keeping up: one score, and the three behaviours it is the mean of.
// - Needs you: the reasons behind the rail's dot, each leading to its tab.
// - Activity: what they did, one kind at a time, a page at a time.
// - The rail: member info, coaching info, and the coach's own note.
// Nothing here saves: every action ends in a toast. A row that leads to a
// tab does open that tab, in the drafts.

export type DraftEvent = { id: string; category: string; text: string; note: string | null; when: string; tab: string };
export type DraftHome = {
  name: string;
  initial: string;
  avatarPath: string | null;
  clientSince: string | null;
  snapshot: OverviewPanel["snapshot"];
  /** The whole client card, for the live editor in the Details dialog. */
  panel: OverviewPanel;
  coachNote: { text: string; savedLabel: string | null };
  actions: HomeAction[];
  events: DraftEvent[];
  eventTotal: number;
  engagement: ClientEngagement;
};

const draftOnly = (what: string) => toast(what, { description: "Not in the redesign yet: the old tab still does this." });
const savedToast = (what: string) => toast.success("Saved", { description: what });

// The live tabs' ids, as the drafts name them.
const DRAFT_TAB: Record<string, string> = { plan: "plan", training: "training", nutrition: "nutrition", measurements: "measurements", meetings: "meetings", photos: "pictures", messages: "messages" };
const TAB_LABEL: Record<string, string> = { plan: "Plan", training: "Training", nutrition: "Nutrition", measurements: "Measurements", meetings: "Meetings", photos: "Progress pictures", messages: "Messages" };
const TONE_LABEL: Record<HomeAction["tone"], string> = { urgent: "Urgent", due: "Due", note: "To read" };
const CATEGORY_LABEL: Record<string, string> = { training: "Training", nutrition: "Nutrition", measurements: "Measurements", notes: "Note", billing: "Invoice", messages: "Message" };
// Activity is read one kind at a time; every source category has a home here.
const FILTERS = [
  { id: "training", label: "Training", holds: ["training", "notes"] },
  { id: "nutrition", label: "Nutrition", holds: ["nutrition"] },
  { id: "measurements", label: "Measurements", holds: ["measurements"] },
  { id: "invoices", label: "Invoices", holds: ["billing"] },
  { id: "messages", label: "Messages", holds: ["messages"] },
] as const;
type FilterId = (typeof FILTERS)[number]["id"];
const PAGE = 12;
const tone = (pct: number) => (pct >= 80 ? "good" : pct >= 50 ? "mid" : "low");

export default function HomeDraft({ clientId, firstName, home, onOpenTab }: { clientId: number; firstName: string; home: DraftHome; onOpenTab: (tab: string) => void }) {
  const [msg, setMsg] = useState(false);
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
  // The facts about them, and the coach's note: a click away, not on the page.
  const [details, setDetails] = useState(false);
  const [photo, setPhoto] = useState(false);
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
  const go = (tab: string | null) => {
    if (!tab) return;
    const t = DRAFT_TAB[tab];
    if (t) onOpenTab(t);
    else draftOnly(TAB_LABEL[tab] ?? tab);
  };
  const eng = home.engagement;
  const shift = eng.overall == null || eng.previous == null ? null : eng.overall - eng.previous;

  return (
    <div className="rd rh">
      <header className="rd-head">
        <div className="rd-head-main">
          <span className="rd-eyebrow">Home</span>
          <h1 className="rd-title rh-title">
            {/* The full name, here alone; the face opens large. */}
            <button type="button" className="rh-avatar" onClick={() => home.avatarPath && setPhoto(true)} title={home.avatarPath ? "See the photo" : undefined} aria-label={home.avatarPath ? `${home.name}'s photo` : undefined} disabled={!home.avatarPath}>
              {home.avatarPath ? (
                // eslint-disable-next-line @next/next/no-img-element -- client-uploaded file
                <img src={home.avatarPath} alt="" />
              ) : (
                home.initial
              )}
            </button>
            {home.name}
            {home.clientSince && <small className="rh-since">{home.clientSince}</small>}
          </h1>
        </div>
        <div className="rd-head-actions">
          <button type="button" className="rd-btn" onClick={() => setDetails(true)}>
            <AccountIcon /> Details
          </button>
          <button type="button" className="rd-btn primary" onClick={() => setMsg(true)}>
            <ChatIcon /> Message
          </button>
        </div>
      </header>

      <div className="rh-cols">
        <div className="rh-main">
          {/* ---- The figures the coach checks first. The phases live on Plan, not here. */}
          <section className="rd-session open rn-card rh-glance">
            <div className="rh-stats">
              {home.snapshot.map((s) => (
                <div key={s.label} className="rh-stat">
                  <span className="rh-stat-label">{s.label}</span>
                  <span className="rh-stat-body">
                    <b className={s.attention ? "warn" : ""}>{s.value}</b>
                    {s.suffix && <small>{s.suffix}</small>}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* ---- Keeping up: one score, three behaviours. */}
          {eng.overall != null && (
            <section className="rd-session open rn-card">
              <div className="rn-card-head">
                <h2>
                  Keeping up <span title={eng.since ? `Counted from ${new Date(`${eng.since}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}, their first day` : undefined}>· last {eng.days} days</span>
                </h2>
              </div>
              <div className="rh-board">
                <div className="rh-score">
                  <Dial pct={eng.overall} />
                  <span className="rh-score-word">Overall</span>
                  {shift == null ? (
                    <span className="rh-trend flat">nothing to compare yet</span>
                  ) : shift === 0 ? (
                    <span className="rh-trend flat">level with the {eng.days} days before</span>
                  ) : (
                    <span className={`rh-trend ${shift > 0 ? "up" : "down"}`}>
                      {shift > 0 ? "▲" : "▼"} {Math.abs(shift)}% vs the {eng.days} days before
                    </span>
                  )}
                </div>
                <div className="rh-rows">
                  {eng.parts.map((p) => (
                    <div key={p.id} className="rh-score-row">
                      <span className="rh-score-name">{p.label}</span>
                      <span className="rh-score-pct">{p.pct}%</span>
                      <span className="rh-score-track">
                        <span className={`rh-score-fill ${tone(p.pct)}`} style={{ width: `${Math.max(0, Math.min(100, p.pct))}%` }} />
                      </span>
                      <span className="rh-score-detail">
                        {p.detail}
                        {p.note && <em>{p.note}</em>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* ---- Needs you: why the rail's dot is on. */}
          <section className="rd-session open rn-card">
            <div className="rn-card-head">
              <h2>
                Needs you <span>· {home.actions.length ? `${home.actions.length} open item${home.actions.length === 1 ? "" : "s"}` : `nothing is waiting on you for ${firstName}`}</span>
              </h2>
              {home.actions.length > 0 && (
                <button type="button" className="rd-btn" onClick={() => setMsg(true)}>
                  Nudge {firstName}
                </button>
              )}
            </div>
            {home.actions.length > 0 ? (
              <div className="rd-rows">
                {home.actions.map((a) => (
                  <div key={a.id} className="rd-row">
                    <button type="button" className={`rd-row-main rh-row${a.tab ? "" : " static"}`} onClick={() => go(a.tab)}>
                      <span className={`rh-tone ${a.tone}`}>{TONE_LABEL[a.tone]}</span>
                      <span className="rh-row-main">
                        <b>{a.title}</b>
                        <small className={a.tone === "note" ? "quote" : ""}>{a.detail}</small>
                      </span>
                      {a.tab && <span className="rd-pill quiet">{TAB_LABEL[a.tab] ?? a.tab}</span>}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rh-empty">All clear.</p>
            )}
          </section>

          {/* ---- Activity: a history, one kind at a time. */}
          <section className="rd-session open rn-card">
            <div className="rn-card-head">
              <h2>Activity</h2>
              <div className="rd-btn-group" role="group" aria-label="Which kind">
                {FILTERS.map((f) => (
                  <button key={f.id} type="button" className={filter === f.id ? "on" : ""} aria-pressed={filter === f.id} onClick={() => pick(f.id)}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            {shown.length > 0 ? (
              <div className="rd-rows">
                {shown.map((e) => (
                  <div key={e.id} className="rd-row">
                    <button type="button" className="rd-row-main rh-row" onClick={() => go(e.tab)}>
                      <span className={`rh-cat ${e.category}`}>{CATEGORY_LABEL[e.category] ?? e.category}</span>
                      <span className="rh-row-main">
                        <b>{e.text.charAt(0).toUpperCase() + e.text.slice(1)}</b>
                        {e.note && <small className="quote">{e.note}</small>}
                      </span>
                      <span className="rh-when">{e.when}</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rh-empty">{home.events.length ? "Nothing of that kind yet." : "Nothing logged yet."}</p>
            )}
            <Pager className="rh-foot" page={at} pages={pages} from={from} shown={shown.length} total={matching.length} label="Activity pages" onPage={setPage} />
          </section>
        </div>

      </div>

      {/* The facts and the note, together, when asked for. */}
      {/* Non-modal: the card editor opens its form in a layer of its own, which a modal dialog would lock out. */}
      <Dialog open={details} modal={false} onOpenChange={(o) => !o && setDetails(false)}>
        {details && (
          <DialogContent className="rd-dlg rh-dlg">
            <DialogHeader>
              <DialogTitle>{home.name}</DialogTitle>
              <DialogDescription hidden>Member info, coaching info and your note about {firstName}.</DialogDescription>
            </DialogHeader>
            <div className="rh-dlg-body">
              {/* The old tab's card editor, as is: member info and coaching info, each with an Edit. */}
              <ClientCardEditor clientId={clientId} panel={home.panel} chrome="rail" />
              <NoteCard text={home.coachNote.text} savedLabel={home.coachNote.savedLabel} onSave={(v) => act(() => saveCoachNoteAction(clientId, v), "Coach note")} />
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* The photo, large. */}
      <Dialog open={photo} onOpenChange={(o) => !o && setPhoto(false)}>
        {photo && home.avatarPath && (
          <DialogContent className="rd-dlg rh-photodlg">
            <DialogHeader>
              <DialogTitle hidden>{home.name}</DialogTitle>
              <DialogDescription hidden>{home.name}&rsquo;s profile photo.</DialogDescription>
            </DialogHeader>
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

// The overall, as one dial.
const STROKE = 10;
const SIZE = 128;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;
function Dial({ pct }: { pct: number }) {
  const filled = (Math.max(0, Math.min(100, pct)) / 100) * C;
  return (
    <div className="rh-dial" style={{ width: SIZE, height: SIZE }}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} aria-hidden="true">
        <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="#eceff3" strokeWidth={STROKE} />
          <circle className={`rh-dial-arc ${tone(pct)}`} cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" strokeWidth={STROKE} strokeLinecap="round" strokeOpacity={filled > 0.5 ? 1 : 0} style={{ strokeDasharray: `${filled} ${C}` }} />
        </g>
      </svg>
      <span className="rh-dial-figure">
        {Math.round(pct)}
        <small>%</small>
      </span>
    </div>
  );
}

// The coach's own note, theirs alone, edited in place.
function NoteCard({ text, savedLabel, onSave }: { text: string; savedLabel: string | null; onSave: (text: string) => void }) {
  const [saved, setSaved] = useState(text);
  const [draft, setDraft] = useState(text);
  const [editing, setEditing] = useState(false);
  return (
    <section className="rd-session open rn-card rh-info">
      <div className="rn-card-head">
        <h2>
          Coach note {savedLabel && <span>· {savedLabel}</span>}
        </h2>
        {!editing && (
          <button type="button" className="rd-ex-btn rh-edit" onClick={() => setEditing(true)}>
            {saved ? "Edit" : "Add"}
          </button>
        )}
      </div>
      {editing ? (
        <div className="rh-note-edit">
          <textarea className="rh-note-box" value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} autoFocus placeholder="Only you see this." aria-label="Coach note" />
          <div className="rh-note-actions">
            <button
              type="button"
              className="rd-btn"
              onClick={() => {
                setDraft(saved);
                setEditing(false);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rd-btn primary"
              disabled={draft.trim() === saved.trim()}
              onClick={() => {
                setSaved(draft.trim());
                setEditing(false);
                onSave(draft.trim());
              }}
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <p className={`rh-note${saved ? "" : " empty"}`}>{saved || "Nothing yet. A standing note about this client, for you alone."}</p>
      )}
    </section>
  );
}
