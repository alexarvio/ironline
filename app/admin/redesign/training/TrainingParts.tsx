"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveProgramWorkoutQuestionsAction, savePhaseNoteAction, setPhaseGoalsAction } from "../../../lib/actions";
import { PHASE_OBJECTIVE_CHARS, PHASE_OBJECTIVES_MAX } from "../../../lib/phaseCovers";
import { MAX_WORKOUT_QUESTIONS, WORKOUT_QUESTION_PRESETS } from "../../../lib/workoutQuestions";
import { ChatIcon, TargetIcon } from "../../../components/icons";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../../components/ui/dropdown-menu";
import { Dialog } from "../../../components/ui/dialog";
import { ConfirmDialog, type DraftAnswered, type DraftProgram } from "./TrainingDraft";
import { SepJoin } from "../Sep";
import { logDate } from "../../../lib/dayMonth";

// The Training tab's restructure (19 Oct, Alex's spec): the header's goals
// and note as two pills with one pop-over, the weeks as a rail of cards, and
// the after-workout check (1 to 10 questions as pills, the answers folded
// into a table). Styled in trn.css, the admin hairline language.

const preview = (s: string) => (s.length > 80 ? `${s.slice(0, 80).trimEnd()}…` : s);
/** The goals in the tip, in turn, cut at 80 characters in all as `preview` cuts the note; a bar between them on screen. */
const previewGoals = (goals: string[]) => {
  const out: string[] = [];
  let left = 80;
  for (const g of goals) {
    if (left <= 0) {
      out[out.length - 1] = `${out[out.length - 1]}…`;
      break;
    }
    if (g.length > left) {
      out.push(`${g.slice(0, left).trimEnd()}…`);
      break;
    }
    out.push(g);
    left -= g.length + 3;
  }
  return out;
};

// ---- Goals and note: two pills, one pop-over under them. The pop-over
// works as the client's note does (20 Oct, Alex): a clean line to write on,
// Cancel and Save only once something changed. The goals are three lines,
// one a goal, as the client's Home shows them under the phase.

const fill = (g: string[]) => Array.from({ length: PHASE_OBJECTIVES_MAX }, (_, i) => g[i] ?? "");

export function GoalsNotePills({ firstName, phaseId, goals, note, area = "training", saveNote }: { firstName: string; /** None on a sheet without a phase (Nutrition's client-level one): the note alone. */ phaseId: number | null; goals: string[]; note: string; /** The tab it sits on (Training, Lifestyle, Nutrition), for the toast. */ area?: string; /** Where the note goes when it isn't the phase's own (Nutrition's is its targets' note, 21 Oct). */ saveNote?: (text: string) => Promise<unknown> }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState<"goals" | "note" | null>(null);
  const [text, setText] = useState("");
  const [rows, setRows] = useState<string[]>(fill([]));
  // Esc, an outside click or ✕ with something changed asks first.
  const [asking, setAsking] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const savedGoals = goals.map((g) => g.trim()).filter(Boolean);
  const savedNote = note.trim();
  const changed = open === "goals" ? rows.map((g) => g.trim()).join("\n") !== fill(savedGoals).join("\n") : open === "note" && text.trim() !== savedNote;
  const tryClose = () => (changed ? setAsking(true) : setOpen(null));
  const closeRef = useRef(tryClose);
  useEffect(() => {
    closeRef.current = tryClose;
  });
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) closeRef.current();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  // The note's line grows with the text.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "0";
    el.style.height = `${Math.max(el.scrollHeight, 30)}px`;
  }, [text, open]);
  const openIt = (k: "goals" | "note") => {
    if (open === k) return tryClose();
    if (open && changed) return setAsking(true);
    setOpen(k);
    setText(savedNote);
    setRows(fill(savedGoals));
    setAsking(false);
  };
  const save = () => {
    const was = open;
    setOpen(null);
    startTransition(async () => {
      if (was === "goals") {
        if (phaseId == null) return;
        const lines = rows.map((g) => g.trim().slice(0, PHASE_OBJECTIVE_CHARS)).filter(Boolean);
        await setPhaseGoalsAction(phaseId, lines);
        toast.success("Saved", { description: lines.length ? `Phase goals · ${firstName} sees them on Home` : "Phase goals cleared" });
      } else {
        if (saveNote) await saveNote(text.trim());
        else if (phaseId != null) await savePhaseNoteAction(phaseId, text.trim());
        toast.success("Saved", { description: text.trim() ? `Note to ${firstName} on ${area}` : "Note removed" });
      }
      router.refresh();
    });
  };
  const pill = (k: "goals" | "note") => {
    const set = k === "goals" ? savedGoals.length > 0 : !!savedNote;
    const name = k === "goals" ? "Phase goals" : `Note to ${firstName}`;
    return (
      <button type="button" className={`trn-pill${set ? " set" : ""}${open === k ? " on" : ""}`} aria-haspopup="dialog" aria-expanded={open === k} aria-label={`${name}, ${set ? "set" : "not set"}`} onClick={() => openIt(k)}>
        {k === "goals" ? <TargetIcon /> : <ChatIcon />}
        {/* One size whatever it holds (20 Oct, Alex): set only changes the colour; the goals say how many. */}
        <span>{name}</span>
        {k === "goals" && <b className="trn-pill-n">{savedGoals.length}</b>}
        {set && open == null && (
          <span className="trn-tip" role="tooltip">
            {k === "goals" ? <SepJoin parts={previewGoals(savedGoals)} /> : preview(savedNote)}
          </span>
        )}
      </button>
    );
  };
  return (
    <div ref={wrap} className="trn-pills">
      {phaseId != null && pill("goals")}
      {pill("note")}
      {open && (
        <div className="trn-pop" role="dialog" aria-label={open === "goals" ? "Phase goals" : `Note to ${firstName}`}>
          <div className="trn-pop-head">
            <span className="trn-pop-label">{open === "goals" ? "Phase goals" : `A note to ${firstName}`}</span>
            <button type="button" className="trn-pop-x" aria-label="Close" onClick={tryClose}>
              ✕
            </button>
          </div>
          {open === "goals" ? (
            <ul className="trn-goals">
              {rows.map((g, i) => (
                <li key={i}>
                  <i aria-hidden="true" />
                  <input
                    value={g}
                    autoFocus={i === 0}
                    maxLength={PHASE_OBJECTIVE_CHARS}
                    onChange={(e) => setRows((r) => r.map((x, j) => (j === i ? e.target.value : x)))}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      const next = e.currentTarget.closest("li")?.nextElementSibling?.querySelector("input");
                      if (next) next.focus();
                      else if (changed) save();
                    }}
                    placeholder={i === 0 ? "What this phase is for" : "Another goal (optional)"}
                    aria-label={`Goal ${i + 1}`}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <textarea
              ref={box}
              // The line under it only once something is typed: it separates the text from Cancel and Save (20 Oct, Alex).
              className={`trn-pop-line${changed ? " typed" : ""}`}
              value={text}
              autoFocus
              rows={1}
              maxLength={1000}
              onChange={(e) => setText(e.target.value)}
              placeholder={`What ${firstName} should keep in mind this phase`}
              aria-label={`Note to ${firstName}`}
            />
          )}
          {asking ? (
            <div className="trn-pop-foot">
              <span className="trn-pop-ask">Discard your changes?</span>
              <button type="button" className="trn-btn ghost" onClick={() => setAsking(false)}>
                Keep editing
              </button>
              <button
                type="button"
                className="trn-btn primary"
                onClick={() => {
                  setAsking(false);
                  setOpen(null);
                }}
              >
                Discard
              </button>
            </div>
          ) : (
            changed && (
              <div className="trn-pop-foot">
                <button type="button" className="trn-btn ghost" onClick={() => setOpen(null)}>
                  Cancel
                </button>
                <button type="button" className="trn-btn primary" onClick={save}>
                  Save
                </button>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

// ---- The week rail: a card a week, one bar a session, the chosen one ringed in ink.

type Week = DraftProgram["weeks"][number];

export function WeekRail({ weeks, viewIdx, dateOf, hrefFor, isLocal, onShow, onAdd, addFrom }: { weeks: Week[]; viewIdx: number; dateOf: (index: number) => string | null; hrefFor: (index: number) => string; isLocal: (index: number) => boolean; onShow: (index: number) => void; /** null: a blank week; else the week it copies. */ onAdd: (from: number | null) => void; /** The weeks offered to copy, first the one before the new week. */ addFrom: { index: number; sessions: number }[] }) {
  return (
    // One row: up to 8 weeks share it evenly with + Week; more, and the rail scrolls sideways.
    <div className={`trn-rail${weeks.length > 8 ? " scroll" : ""}`} role="tablist" aria-label="Weeks" style={{ "--trn-cards": weeks.length + 1 } as React.CSSProperties}>
      {weeks.map((w) => {
        const done = w.trained.filter(Boolean).length;
        const total = w.trained.length;
        const on = w.index === viewIdx;
        const now = w.state === "live";
        return (
          <Link
            key={w.index}
            role="tab"
            aria-selected={on}
            aria-label={`Week ${w.index}${now ? ", current week" : ""}, ${done} of ${total} sessions done`}
            href={hrefFor(w.index)}
            scroll={false}
            className={`trn-week${on ? " on" : ""}`}
            onClick={(e) => {
              // A week held on this screen switches in place; the rest load from the server.
              if (isLocal(w.index)) {
                e.preventDefault();
                onShow(w.index);
              }
            }}
          >
            <span className="trn-week-top">
              <span className="trn-week-name">Week {w.index}</span>
              {/* Black, a green pulse on its left (20 Oct, Alex). */}
              {now && (
                <span className="trn-now" aria-hidden="true">
                  <i className="trn-pulse" />
                  NOW
                </span>
              )}
            </span>
            <span className="trn-bars" aria-hidden="true">
              {w.trained.map((t, i) => (
                <i key={i} className={t ? "on" : ""} />
              ))}
            </span>
            <span className="trn-week-foot">
              <span>{dateOf(w.index) ?? ""}</span>
              {total > 0 && (
                <span>
                  {done}/{total}
                </span>
              )}
            </span>
          </Link>
        );
      })}
      {/* + Week opens a white menu whose choice is the action (20 Oct, Alex: the pop-up was too black): Blank, or a copy of the week before it, or of the one on screen. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger className="trn-week add">
          <span className="trn-week-top">
            <span className="trn-week-name">+ Week</span>
          </span>
          <span className="trn-bars" aria-hidden="true" />
          <span className="trn-week-foot">
            <span>{dateOf(weeks.length + 1) ?? "Add one"}</span>
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="pb-menu trn-addweek-menu">
          <DropdownMenuItem onSelect={() => onAdd(null)}>Blank</DropdownMenuItem>
          {addFrom.map((w) => (
            <DropdownMenuItem key={w.index} onSelect={() => onAdd(w.index)}>
              Copy Week {w.index}
              <small className="rd-menu-inuse">
                {w.sessions} {w.sessions === 1 ? "session" : "sessions"}
              </small>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ---- After-workout check: the questions as pills, the answers folded under them.

type Q = DraftProgram["workoutQuestions"][number];

export function AfterWorkoutCheck({ programId, firstName, questions, answers, href }: { programId: number; firstName: string; questions: Q[]; answers: DraftAnswered[]; href: (it: DraftAnswered) => string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [list, setList] = useState(questions);
  // Reset by content: a page re-read hands in a new array with the same questions.
  const key = JSON.stringify(questions);
  const [seen, setSeen] = useState(key);
  if (seen !== key) {
    setSeen(key);
    setList(questions);
  }
  const [removing, setRemoving] = useState<Q | null>(null);
  const save = (next: Q[], said: string) => {
    setList(next);
    startTransition(async () => {
      await saveProgramWorkoutQuestionsAction(programId, next);
      router.refresh();
      toast.success("Saved", { description: said });
    });
  };
  const full = list.length >= MAX_WORKOUT_QUESTIONS;
  // The ready questions not asked yet (20 Oct, Alex: a plain + Add, no typing for now).
  const sugs = WORKOUT_QUESTION_PRESETS.filter((p) => !list.some((x) => x.label.toLowerCase() === p.label.toLowerCase()));
  const add = (p: (typeof WORKOUT_QUESTION_PRESETS)[number]) => {
    if (full || list.some((x) => x.label.toLowerCase() === p.label.toLowerCase())) return;
    // A ready question keeps its id, so its answers stay one series (and Enjoyment, Adherence fill their metrics).
    save([...list, { id: p.id, label: p.label, kind: "scale" }], `${p.label} added · asked from ${firstName}'s next workout`);
  };
  const answered = (label: string) => answers.some((a) => a.answers.some((x) => x.label === label && (x.value != null || !!(x.text ?? "").trim())));
  const remove = (q: Q) => save(list.filter((x) => x.id !== q.id), `${q.label} removed · past answers kept`);

  // The latest three workouts always show; the rest open under them, ten at a time.
  const PREVIEW = 3;
  const [all, setAll] = useState(false);
  const [limit, setLimit] = useState(10);
  // The columns: today's questions, then any asked before and since removed (their answers are kept).
  const labels = [...list.map((q) => q.label), ...answers.flatMap((a) => a.answers.map((x) => x.label))].filter((l, i, all) => all.indexOf(l) === i);
  const avg = (label: string) => {
    const xs = answers.flatMap((a) => a.answers.filter((x) => x.label === label && x.kind !== "text" && x.value != null).map((x) => x.value!));
    return xs.length ? Math.round((xs.reduce((t, x) => t + x, 0) / xs.length) * 10) / 10 : null;
  };
  const cell = (it: DraftAnswered, label: string) => {
    const a = it.answers.find((x) => x.label === label);
    if (!a) return "–";
    if (a.kind === "text") return (a.text ?? "").trim() || "–";
    return a.value == null ? "–" : `${a.value}${a.kind === "number" && a.unit ? ` ${a.unit}` : ""}`;
  };
  // The question columns share the width (each wide enough for its name, its average and the ✕), so a wide screen isn't left empty.
  const grid = { gridTemplateColumns: `110px minmax(180px, 1.4fr) repeat(${labels.length}, minmax(210px, 1fr))` } as const;
  const minW = 110 + 180 + labels.length * 210;
  const rows = all ? answers.slice(0, limit) : answers.slice(0, PREVIEW);

  return (
    // One table (20 Oct, Alex: the averages jumped from the head row into the table when Answers opened, and the card
    // read as three things): the questions are its columns, each with its average in its head; the latest workouts under them.
    <section className="trn-check" aria-labelledby="trn-check-h">
      <div className="trn-check-head">
        <h2 id="trn-check-h">After-workout check</h2>
        {!full && sugs.length > 0 && (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger className="trn-q-plus">+ Add</DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="pb-menu trn-q-menu">
              {sugs.map((p) => (
                <DropdownMenuItem key={p.id} onSelect={() => add(p)}>
                  {p.label}
                  <small className="rd-menu-inuse">1–10</small>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {labels.length === 0 ? (
        <p className="trn-ans-empty">No questions yet</p>
      ) : (
        <div className="trn-ans-scroll">
          <div className="trn-ans-table" style={{ minWidth: minW }}>
            <div className="trn-ans-row trn-ans-cols" style={grid}>
              <span>Date</span>
              <span>Session</span>
              {/* A question's head: its name, its average, and ✕ on hover to stop asking it (a removed one keeps its column, without the ✕). */}
              {labels.map((l) => {
                const q = list.find((x) => x.label === l);
                const a = avg(l);
                return (
                  <span key={l} className={`trn-ans-q${q ? "" : " gone"}`}>
                    <span className="trn-ans-qname">{l}</span>
                    {q && q.kind && q.kind !== "scale" && <small>{q.kind === "number" ? q.unit || "Value" : "Text"}</small>}
                    {a != null && <em className="trn-ans-avgval">Avg {a}</em>}
                    {q && (
                      <button type="button" className="trn-ans-x" aria-label={`Stop asking ${l}`} title={`Stop asking ${l}`} onClick={() => (answered(l) ? setRemoving(q) : remove(q))}>
                        ✕
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
            {answers.length === 0 ? (
              <div className="trn-ans-row trn-ans-nil">No answers yet</div>
            ) : (
              rows.map((it) => (
                <Link key={it.dayId} href={href(it)} scroll={false} className="trn-ans-row" style={grid} title={`Open ${it.name}, ${it.weekLabel}`}>
                  <span className="rd-logdate">{logDate(it.ended)}</span>
                  <span className="trn-ans-session">
                    {it.name} <small>{it.weekLabel}</small>
                  </span>
                  {labels.map((l) => (
                    <span key={l} className="trn-ans-val" title={cell(it, l)}>
                      {cell(it, l)}
                    </span>
                  ))}
                </Link>
              ))
            )}
          </div>
          {answers.length > PREVIEW && (
            <div className="trn-ans-foot">
              {all && answers.length > limit && (
                <button type="button" className="trn-ans-more" onClick={() => setLimit((n) => n + 10)}>
                  Show more
                </button>
              )}
              <button
                type="button"
                className="trn-ans-more"
                onClick={() => {
                  setAll((v) => !v);
                  setLimit(10);
                }}
              >
                {all ? "Show fewer" : `Show all ${answers.length}`}
              </button>
            </div>
          )}
        </div>
      )}
      <Dialog open={removing != null} onOpenChange={(o) => !o && setRemoving(null)}>
        {removing && (
          <ConfirmDialog
            title={`Remove ${removing.label}?`}
            description={`${firstName} stops being asked it from their next workout. The answers already given are kept.`}
            confirm="Remove"
            danger
            onConfirm={() => {
              const q = removing;
              setRemoving(null);
              remove(q);
            }}
          />
        )}
      </Dialog>
    </section>
  );
}

/** The six-dot grip a session row is dragged by. */
export function GripIcon() {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">
      <circle cx="2.5" cy="3" r="1.4" />
      <circle cx="7.5" cy="3" r="1.4" />
      <circle cx="2.5" cy="8" r="1.4" />
      <circle cx="7.5" cy="8" r="1.4" />
      <circle cx="2.5" cy="13" r="1.4" />
      <circle cx="7.5" cy="13" r="1.4" />
    </svg>
  );
}
