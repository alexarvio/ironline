"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { saveProgramWorkoutQuestionsAction } from "../../../lib/actions";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../../components/ui/dropdown-menu";
import { ChevronDownIcon, MoreIcon, PlusIcon, TrashIcon } from "../../../components/icons";
import { SortableItem, SortableList } from "../Sortable";
import { useClickAway } from "./TrainingDraft";
import { MAX_QUESTION_LENGTH, MAX_WORKOUT_QUESTIONS, WORKOUT_QUESTION_PRESETS } from "../../../lib/workoutQuestions";

// The workout questionnaire (30 Sep): what the client is asked, 1 to 10
// each, before ending a workout. Each training phase (programme) has its own,
// so it sits under the phase's tracked metrics but is not part of them.
// Like the metrics card: adds, removals, renames and a new order queue on
// the bar until Apply. It lives on the Training tab only (moved from Measurements).

type Kind = "scale" | "number" | "text";
type Q = { id: string; label: string; kind?: Kind; unit?: string };
type Row = { id: string; label: string; kind: Kind; unit: string };
const KINDS: { id: Kind; label: string }[] = [
  { id: "scale", label: "1–10" },
  { id: "number", label: "Value" },
  { id: "text", label: "Text" },
];
const rowOf = (q: Q): Row => ({ id: q.id, label: q.label, kind: q.kind ?? "scale", unit: q.unit ?? "" });

export default function WorkoutQuestionsCard({ programId, firstName, questions: given }: { programId: number; firstName: string; questions: Q[] }) {
  const questions = given.map(rowOf);
  const [saved, setSaved] = useState(questions);
  const [rows, setRows] = useState(questions);
  const [adding, setAdding] = useState(false);
  const router = useRouter();
  const [, startTransition] = useTransition();
  // Reset by content, not by the prop's identity: a re-read of the page
  // after another card saves must not wipe edits not yet applied.
  const key = JSON.stringify(questions);
  const [seen, setSeen] = useState(key);
  if (seen !== key) {
    setSeen(key);
    setSaved(questions);
    setRows(questions);
  }
  const clean = rows.map((r) => ({ ...r, label: r.label.trim(), unit: r.kind === "number" ? r.unit.trim() : "" }));
  const setRow = (id: string, patch: Partial<Row>) => setRows((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const changed = JSON.stringify(clean) !== JSON.stringify(saved);
  const blank = clean.some((r) => !r.label);
  // One a question added, removed or edited, one more for a new order.
  const changeCount = (() => {
    const was = new Map(saved.map((q) => [q.id, q]));
    let c = saved.filter((q) => !clean.some((r) => r.id === q.id)).length;
    for (const r of clean) {
      const b = was.get(r.id);
      if (!b || b.label !== r.label || b.kind !== r.kind || b.unit !== r.unit) c += 1;
    }
    const kept = clean.filter((r) => was.has(r.id)).map((r) => r.id);
    if (kept.some((id, i) => id !== saved.filter((q) => kept.includes(q.id))[i]?.id)) c += 1;
    return c;
  })();
  const isNew = (id: string) => !saved.some((q) => q.id === id);
  const full = rows.length >= MAX_WORKOUT_QUESTIONS;
  const grid = { gridTemplateColumns: "20px minmax(220px, 1fr) minmax(340px, auto) 32px", columnGap: 24 } as const;

  const apply = () => {
    setSaved(clean);
    setRows(clean);
    startTransition(async () => {
      await saveProgramWorkoutQuestionsAction(programId, clean);
      router.refresh();
      toast.success("Saved", { description: clean.length ? `Workout questionnaire: ${clean.length} ${clean.length === 1 ? "question" : "questions"}` : "No questions at the end of a workout" });
    });
  };

  return (
    <section className="rd-session open rn-card">
      <div className="rn-card-head">
        <h2>Workout questionnaire</h2>
        <span className="rm-q-sub">
          Asked as {firstName} ends every workout in this phase
        </span>
      </div>
      <div className="rd-rows">
        {rows.length > 0 && (
          <div className="rd-cols" aria-hidden="true" style={grid}>
            <span />
            <span>Question</span>
            <span>Answered as</span>
            <span />
          </div>
        )}
        <SortableList ids={rows.map((r) => r.id)} label="question" onMove={(ids) => setRows((prev) => ids.map((id) => prev.find((r) => r.id === id)!).filter(Boolean))}>
          {rows.map((r) => {
            const was = saved.find((q) => q.id === r.id);
            return (
              <SortableItem key={r.id} id={r.id} className={`rd-row${isNew(r.id) ? " new" : ""}`}>
                {(grip) => (
                  <div className="rd-row-main static" style={grid}>
                    <span className="rd-grip" {...grip}>
                      ⋮⋮
                    </span>
                    <span className="rd-ex">
                      <input
                        className={`rm-q-input${was && was.label !== r.label.trim() ? " changed" : ""}`}
                        value={r.label}
                        maxLength={MAX_QUESTION_LENGTH}
                        onChange={(e) => setRow(r.id, { label: e.target.value })}
                        aria-label="Question"
                        placeholder="Question"
                      />
                      {isNew(r.id) && <small>New · not applied yet</small>}
                    </span>
                    {/* How it is answered: the ten pills, a number (with its unit box beside the switch), or words. */}
                    <span className="rm-q-how">
                      <span className="rm-cadence rm-q-kind" role="group" aria-label={`How ${r.label || "this"} is answered`}>
                        {KINDS.map((k) => (
                          <button key={k.id} type="button" className={`${r.kind === k.id ? "on" : ""}${r.kind === k.id && was && was.kind !== k.id ? " changed" : ""}`} aria-pressed={r.kind === k.id} onClick={() => setRow(r.id, { kind: k.id })}>
                            {k.label}
                          </button>
                        ))}
                      </span>
                      {r.kind === "number" && <input className={`rm-q-unit${was && was.unit !== r.unit.trim() ? " changed" : ""}`} value={r.unit} maxLength={12} onChange={(e) => setRow(r.id, { unit: e.target.value })} placeholder="Unit · kg, min, h" aria-label={`Unit for ${r.label}`} />}
                    </span>
                    <span className="rd-row-more">
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger className="rd-btn ghost sm" aria-label={`More for ${r.label}`}>
                          <MoreIcon />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="pb-menu">
                          <DropdownMenuItem variant="destructive" onSelect={() => setRows((prev) => prev.filter((x) => x.id !== r.id))}>
                            <TrashIcon /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </span>
                  </div>
                )}
              </SortableItem>
            );
          })}
        </SortableList>
        {rows.length === 0 && <div className="rm-q-empty">No questions: {firstName} ends a workout with only the note to you.</div>}
        {adding ? (
          <AddQuestionRow
            have={rows}
            full={full}
            onAdd={(q) => setRows((prev) => (prev.length >= MAX_WORKOUT_QUESTIONS || prev.some((x) => x.id === q.id || x.label.toLowerCase() === q.label.toLowerCase()) ? prev : [...prev, rowOf(q)]))}
            onClose={() => setAdding(false)}
          />
        ) : full ? (
          <div className="rm-q-empty">{MAX_WORKOUT_QUESTIONS} questions at most, so the end of a workout stays quick.</div>
        ) : (
          <button type="button" className="rd-session add rm-additem" onClick={() => setAdding(true)}>
            + Add question
          </button>
        )}
        {changed && (
          <div className="rd-pending">
            <span className="rd-pending-count">{changeCount || 1}</span>
            <span className="rd-pending-text">
              {changeCount === 1 ? "change" : "changes"} to what {firstName} is asked after a workout{blank ? " · every question needs words" : " · asked from their next workout once applied"}
            </span>
            <button type="button" className="rd-pending-ghost" onClick={() => setRows(saved)}>
              Discard
            </button>
            <button type="button" className="rd-pending-apply" onClick={apply} disabled={blank}>
              Apply
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

// Built as Add metric is (30 Sep): the long search bar with the chevron at
// its end; typing lists the ready questions that match, the one under the
// cursor in blue, and offers what was typed as the coach's own. The chevron
// opens every ready question. A taken one stays in the list, greyed.
function AddQuestionRow({ have, full, onAdd, onClose }: { have: Q[]; full: boolean; onAdd: (q: Q) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [browse, setBrowse] = useState(false);
  const [cursor, setCursor] = useState(0);
  const box = useRef<HTMLInputElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  useClickAway(wrap, onClose);
  useEffect(() => {
    box.current?.focus();
  }, []);
  const needle = q.trim().toLowerCase();
  const taken = (x: Q) => have.some((h) => h.id === x.id || h.label.toLowerCase() === x.label.toLowerCase());
  const list = needle ? WORKOUT_QUESTION_PRESETS.filter((x) => x.label.toLowerCase().includes(needle)) : browse ? WORKOUT_QUESTION_PRESETS : [];
  const exact = needle && !WORKOUT_QUESTION_PRESETS.some((x) => x.label.toLowerCase() === needle) && !have.some((h) => h.label.toLowerCase() === needle);
  const pick = (x: Q) => {
    if (taken(x) || full) return;
    onAdd(x);
    setQ("");
    setCursor(0);
    setBrowse(false);
    box.current?.focus();
  };
  const own = () => {
    if (!exact || full) return;
    onAdd({ id: `q-${Date.now().toString(36)}`, label: q.trim().slice(0, MAX_QUESTION_LENGTH) });
    setQ("");
    setCursor(0);
    box.current?.focus();
  };
  return (
    <div ref={wrap} className="rd-addrow">
      <div className={`rd-addrow-bar${browse || needle ? " open" : ""}`}>
        <input
          ref={box}
          className="rd-addrow-search"
          value={q}
          maxLength={MAX_QUESTION_LENGTH}
          onChange={(e) => {
            setQ(e.target.value);
            setCursor(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              if (browse) setBrowse(false);
              else onClose();
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              if (!needle && !browse) setBrowse(true);
              setCursor((c) => Math.min(c + 1, Math.max(0, list.length - 1)));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setCursor((c) => Math.max(c - 1, 0));
            }
            if (e.key === "Enter") {
              if (list[cursor] && !taken(list[cursor])) pick(list[cursor]);
              else own();
            }
          }}
          placeholder="Search questions, or type your own"
          aria-label="Search questions"
        />
        <button
          type="button"
          className={`rd-addrow-chev${browse ? " open" : ""}`}
          onClick={() => {
            setBrowse((o) => !o);
            box.current?.focus();
          }}
          aria-label={browse ? "Hide the ready questions" : "Show the ready questions"}
        >
          <ChevronDownIcon />
        </button>
        <button type="button" className="rd-addrow-x" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      {(browse || needle) && (
        <div className="rd-addrow-list" role="listbox" aria-label="Questions">
          {list.map((x, i) => (
            <button key={x.id} type="button" role="option" aria-selected={i === cursor} className={`rd-addrow-item${i === cursor ? " on" : ""}${taken(x) ? " taken" : ""}`} disabled={taken(x) || full} onMouseEnter={() => setCursor(i)} onClick={() => pick(x)}>
              {x.label}
              <small>{taken(x) ? "on the list" : "1 to 10"}</small>
            </button>
          ))}
          {exact && (
            <button type="button" className={`rd-addrow-item create${list.length === 0 ? " on" : ""}`} disabled={full} onClick={own}>
              <PlusIcon /> Create &ldquo;{q.trim()}&rdquo; as your own question
            </button>
          )}
        </div>
      )}
      {full && <p className="rd-addrow-hint">{MAX_WORKOUT_QUESTIONS} questions at most, so the end of a workout stays quick.</p>}
    </div>
  );
}
