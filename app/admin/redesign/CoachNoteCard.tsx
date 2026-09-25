"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDownIcon } from "../../components/icons";
import "./phase-goals.css";

// The coach's note to the client on a tab (Nutrition, Training), the one
// the client reads at the top of theirs. The same card as Phase goals: folded
// to its head, the chevron opens a box; edits wait in the navy bar until
// Apply. Empty and applied, the client's card goes.
export default function CoachNoteCard({ firstName, note, what, save }: { firstName: string; note: string; /** "nutrition", "training": for the toast. */ what: string; save: (text: string) => Promise<unknown> }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [text, setText] = useState(note);
  const [open, setOpen] = useState(false);
  // Another phase picked, or the page re-read: what is saved shows.
  const [seen, setSeen] = useState(note);
  if (seen !== note) {
    setSeen(note);
    setText(note);
  }
  const changed = text.trim() !== note.trim();
  const apply = () => {
    const next = text.trim();
    startTransition(async () => {
      await save(next);
      router.refresh();
      toast.success("Saved", { description: next ? `Note to ${firstName} on ${what}` : "Note removed" });
    });
  };

  return (
    <section className={`rd-goals${open ? " open" : ""}`}>
      <h2 className="rd-goals-h">
        <button type="button" className="rd-goals-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span className="rd-goals-title">Note to {firstName}</span>
          <span className="rd-goals-sub">{note.trim() ? `On ${firstName}'s ${what} tab` : "None yet"}</span>
          <span className={`rd-goals-chev${open ? " open" : ""}`} aria-hidden="true">
            <ChevronDownIcon />
          </span>
        </button>
      </h2>
      {open && (
        <div className="rd-note-body">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            maxLength={1000}
            placeholder={`What ${firstName} should keep in mind on ${what}: what's going well, what to push, what to watch.`}
            aria-label={`Note to ${firstName}`}
          />
        </div>
      )}
      {changed && (
        <div className="rd-pending">
          <span className="rd-pending-count">1</span>
          <span className="rd-pending-text">change to the note · {firstName} sees it on {what}</span>
          <button type="button" className="rd-pending-ghost" onClick={() => setText(note)}>
            Discard
          </button>
          <button type="button" className="rd-pending-apply" onClick={apply}>
            Apply
          </button>
        </div>
      )}
    </section>
  );
}
