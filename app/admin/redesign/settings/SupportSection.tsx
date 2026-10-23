"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "../../../components/ui/dialog";
import type { SupportLine, SupportSectionData } from "../../../lib/support";
import { loadSupportThreadAction, markSupportSeenAction, sendSupportAction } from "../../../lib/supportActions";
import "./support.css";

// Settings' Support (23 Oct, Alex: "where the coaches can go in and talk to someone from the company or report an
// issue"; docs/DESIGN-RULES-ADMIN.md 9b). The body of the Settings page's Support section (SettingsBoard draws its
// title and Fold), one hairline card: the coach's thread with the company as the chat draws one (their own words on the
// right on the neutral tint, the company's white with a hairline on the left; a problem with its rust state pill, where
// in grey, its screenshot as a thumbnail that opens big, a green Done pill once the owner closed it), then the message
// line (words on a clean line, the ink Send) with Report a problem beside it as a white pill, which turns the line into
// a problem: what happened and where on clean lines, Attach screenshot in words (a pasted picture too), Cancel in words
// and the ink Send. The owner answers from Coaches and has no Support section (loadSupportSection is null). Read again
// every so often while open; the company's lines are read once the card is really on screen. Prefix sup- (support.css).

const POLL_MS = 20_000;

/** Reads `load` every POLL_MS while the tab is visible, and at once when it comes back. */
function usePoll(load: () => void, on = true) {
  const ref = useRef(load);
  useEffect(() => {
    ref.current = load;
  });
  useEffect(() => {
    if (!on) return;
    const tick = () => {
      if (document.visibilityState === "visible") ref.current();
    };
    const t = window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [on]);
}

/** A flag, drawn as the app's icons are (stroke 1.6, round). */
function FlagIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.5 14V2.5m0 0h7.2l-1.4 2.75 1.4 2.75H3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A line still on its way, drawn faded on the sender's side. */
export type SupportPending = { key: string; text: string };

/**
 * A thread, oldest first, a heading over each day, the viewer's own words on the right. `onDone` (the owner) puts
 * Done in words on an open problem. Scrolls itself to its newest line, never the page.
 */
export function SupportThread({ lines, pending = [], onDone }: { lines: SupportLine[]; pending?: SupportPending[]; onDone?: (id: number) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [big, setBig] = useState<string | null>(null);
  const newest = `${lines.length}:${lines[lines.length - 1]?.id ?? 0}:${pending.length}`;
  useEffect(() => {
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [newest]);
  if (lines.length === 0 && pending.length === 0) return null;

  const days: { day: string; items: SupportLine[] }[] = [];
  for (const l of lines) {
    const last = days[days.length - 1];
    if (last && last.day === l.day) last.items.push(l);
    else days.push({ day: l.day, items: [l] });
  }
  return (
    <>
      <div ref={box} className="sup-thread" role="log" aria-label="Support thread">
        {days.map((d, i) => (
          <div key={`${d.day}-${i}`} className="sup-day">
            <span className="sup-dayname">{d.day}</span>
            {d.items.map((l) => (
              <div key={l.id} className={`sup-row${l.mine ? " mine" : ""}`}>
                <div className={`sup-bubble${l.kind === "problem" ? " problem" : ""}`}>
                  {l.kind === "problem" && (
                    <div className="sup-tagline">
                      <span className="trn-state warn sup-tag">Problem</span>
                      {l.where && <span className="sup-where">{l.where}</span>}
                      {l.done ? (
                        <span className="trn-state good sup-done">Done</span>
                      ) : (
                        onDone && (
                          <button type="button" className="sup-doneact" aria-label="Mark problem done" onClick={() => onDone(l.id)}>
                            Done
                          </button>
                        )
                      )}
                    </div>
                  )}
                  <div className="sup-text">
                    {l.text}
                    <span className="sup-time">{l.time}</span>
                  </div>
                  {l.image && (
                    <button type="button" className="sup-shot" onClick={() => setBig(l.image)} aria-label="Open the screenshot">
                      {/* eslint-disable-next-line @next/next/no-img-element -- a coach's upload, served by the app */}
                      <img src={`${l.image}?w=480`} alt="" loading="lazy" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
        {pending.map((p) => (
          <div key={p.key} className="sup-row mine sending">
            <div className="sup-bubble">
              <div className="sup-text">{p.text}</div>
            </div>
          </div>
        ))}
      </div>
      <Dialog open={big != null} onOpenChange={(o) => !o && setBig(null)}>
        {big && (
          <DialogContent className="sup-big" aria-describedby={undefined}>
            <DialogTitle className="sup-big-title">Screenshot</DialogTitle>
            {/* eslint-disable-next-line @next/next/no-img-element -- a coach's upload, served by the app */}
            <img src={big} alt="Screenshot" />
            <DialogClose className="sup-big-x" aria-label="Close">
              ✕
            </DialogClose>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

/** The message line: words on a clean line, Enter sends (Shift+Enter a new line), the ink Send; `extra` beside it. */
export function SupportLineBox({ value, onChange, onSend, placeholder, label, busy = false, extra }: { value: string; onChange: (v: string) => void; onSend: () => void; placeholder: string; label: string; busy?: boolean; extra?: ReactNode }) {
  const ready = !!value.trim() && !busy;
  const key = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (ready) onSend();
    }
  };
  return (
    <div className="sup-compose">
      <textarea className="dlh-line sup-line" rows={1} value={value} placeholder={placeholder} aria-label={label} maxLength={4000} onChange={(e) => onChange(e.target.value)} onKeyDown={key} />
      {extra}
      <button type="button" className="dlh-go sup-send" disabled={!ready} onClick={onSend}>
        Send
      </button>
    </div>
  );
}

/** The Support section's body: the card alone (SettingsBoard draws the section, its title and Fold). */
export default function SupportSection({ thread }: SupportSectionData) {
  return <CoachSupport initial={thread} />;
}

// As lib/support.ts's SUPPORT_IMAGE_TYPES: no HEIC, which most browsers can't draw (an iPhone hands over a JPEG).
const SCREENSHOT_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const SCREENSHOT_MAX = 20 * 1024 * 1024;

function CoachSupport({ initial }: { initial: SupportLine[] }) {
  const [lines, setLines] = useState(initial);
  const [pending, setPending] = useState<SupportPending[]>([]);
  const [mode, setMode] = useState<"message" | "problem">("message");
  const [text, setText] = useState("");
  const [where, setWhere] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const card = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const seeing = useRef(false);

  // The screenshot's own little picture while it is attached, let go with it.
  const shown = useRef<string | null>(null);
  const pick = (f: File | null) => {
    if (shown.current) URL.revokeObjectURL(shown.current);
    shown.current = f ? URL.createObjectURL(f) : null;
    setFile(f);
    setPreview(shown.current);
  };
  useEffect(
    () => () => {
      if (shown.current) URL.revokeObjectURL(shown.current);
    },
    []
  );

  // Read again every so often, unless something is on its way.
  usePoll(() => {
    if (busy) return;
    loadSupportThreadAction().then(setLines, () => {});
  });

  // The company's lines are read once the card is on screen in a tab on screen: when it comes into view, or when the
  // tab comes back with it in view (an observer says nothing then).
  const unread = lines.some((l) => l.unread);
  useEffect(() => {
    const el = card.current;
    if (!el || !unread) return;
    let inView = false;
    const seen = () => {
      if (!inView || document.visibilityState !== "visible" || seeing.current) return;
      seeing.current = true;
      setLines((ls) => ls.map((l) => (l.unread ? { ...l, unread: false } : l)));
      markSupportSeenAction()
        // The rail's Support dot goes with them (the page drawn again; what is typed elsewhere stays).
        .then(() => router.refresh())
        .catch(() => {})
        .finally(() => {
          seeing.current = false;
        });
    };
    // A share of it showing: a folded Settings section clips it to nothing, which can still count as intersecting.
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[entries.length - 1];
        inView = e.isIntersecting && e.intersectionRatio > 0;
        seen();
      },
      { threshold: [0, 0.1] }
    );
    io.observe(el);
    document.addEventListener("visibilitychange", seen);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", seen);
    };
  }, [unread, router]);

  const attach = (f: File | null | undefined) => {
    if (!f) return;
    if (!SCREENSHOT_TYPES.includes(f.type)) return setError("The screenshot has to be a picture.");
    if (f.size > SCREENSHOT_MAX) return setError("That screenshot is over 20 MB.");
    setError(null);
    pick(f);
  };
  // A screenshot on the clipboard pastes straight in.
  const paste = (e: ClipboardEvent) => {
    const f = Array.from(e.clipboardData.files).find((x) => x.type.startsWith("image/"));
    if (f) {
      e.preventDefault();
      attach(f);
    }
  };

  // Closing the problem form with focus in it (Cancel, Escape, sent) puts focus on Report a problem, not the page's top.
  const reportBtn = useRef<HTMLButtonElement>(null);
  const problemBox = useRef<HTMLDivElement>(null);
  const refocus = useRef(false);
  useEffect(() => {
    if (mode !== "message" || !refocus.current) return;
    refocus.current = false;
    reportBtn.current?.focus({ preventScroll: true });
  }, [mode]);

  const reset = () => {
    const at = document.activeElement;
    refocus.current = !!problemBox.current && (problemBox.current.contains(at) || at === document.body);
    setMode("message");
    setText("");
    setWhere("");
    pick(null);
    setError(null);
  };

  const send = () => {
    const words = text.trim();
    if (!words || busy) return;
    const fd = new FormData();
    fd.set("kind", mode);
    fd.set("text", words);
    if (mode === "problem") {
      fd.set("where", where.trim());
      if (file) fd.set("file", file);
    }
    setBusy(true);
    setError(null);
    // A message shows at once, faded until it is in; a problem keeps its form until then.
    const key = `p${Date.now()}`;
    const asMessage = mode === "message";
    if (asMessage) {
      setPending((p) => [...p, { key, text: words }]);
      setText("");
    }
    sendSupportAction(fd)
      .then(
        (r) => {
          if (r.ok) {
            setLines(r.thread);
            if (!asMessage) reset();
          } else {
            setError(r.error);
            if (asMessage) setText(words);
          }
        },
        () => {
          setError("Not sent. Check your connection and try again.");
          if (asMessage) setText(words);
        }
      )
      .finally(() => {
        setBusy(false);
        if (asMessage) setPending((p) => p.filter((x) => x.key !== key));
      });
  };

  const problemKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      reset();
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div ref={card} className="rls-card sup-card">
      <SupportThread lines={lines} pending={pending} />
      {mode === "message" ? (
        <SupportLineBox
          value={text}
          onChange={setText}
          onSend={send}
          placeholder="Message"
          label="Message to NorCoach"
          busy={busy}
          extra={
            <button
              ref={reportBtn}
              type="button"
              className="trn-pill sup-report"
              onClick={() => {
                setMode("problem");
                setError(null);
              }}
            >
              <FlagIcon /> Report a problem
            </button>
          }
        />
      ) : (
        <div ref={problemBox} className={`sup-problem${busy ? " busy" : ""}`} onPaste={paste} onKeyDown={problemKey}>
          <label className="sup-field">
            <span className="dlh-label">What happened</span>
            <textarea className="dlh-line sup-line" rows={2} value={text} maxLength={4000} autoFocus onChange={(e) => setText(e.target.value)} />
          </label>
          <label className="sup-field">
            <span className="dlh-label">Where</span>
            <input className="dlh-line" value={where} maxLength={200} onChange={(e) => setWhere(e.target.value)} />
          </label>
          <div className="sup-foot">
            {file ? (
              <span className="sup-file">
                {/* eslint-disable-next-line @next/next/no-img-element -- the coach's own file, before it is sent */}
                {preview && <img src={preview} alt="" />}
                <span className="sup-file-name">{file.name || "Screenshot"}</span>
                <button type="button" className="sup-textact" onClick={() => pick(null)}>
                  Remove
                </button>
              </span>
            ) : (
              <button type="button" className="sup-textact" onClick={() => picker.current?.click()}>
                Attach screenshot
              </button>
            )}
            <input
              ref={picker}
              type="file"
              accept={SCREENSHOT_TYPES.join(",")}
              hidden
              onChange={(e) => {
                attach(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <span className="sup-foot-end">
              <button type="button" className="dlh-cancel" onClick={reset}>
                Cancel
              </button>
              <button type="button" className="dlh-go" disabled={!text.trim() || busy} onClick={send}>
                Send
              </button>
            </span>
          </div>
        </div>
      )}
      {error && (
        <p className="sup-err" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
