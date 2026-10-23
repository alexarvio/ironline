"use client";

import { useEffect, useRef, useState } from "react";
import { Fold } from "../Fold";
import { pic } from "../../../lib/pic";
import type { SupportInboxRow, SupportLine } from "../../../lib/support";
import { loadSupportInboxAction, loadSupportThreadForOwnerAction, markSupportProblemDoneAction, markSupportThreadSeenAction, replySupportAction } from "../../../lib/supportActions";
import { SupportLineBox, SupportThread, type SupportPending } from "../settings/SupportSection";

// The owner's Support inbox on Coaches (23 Oct, Alex; lib/support.ts): what the coaches wrote from Settings' Support,
// one hairline card, a coach a row, the newest word first: the face, the name semi-bold with the chevron after it, the
// last line grey cut to the line, a rust "1 problem" pill while one is open, the rust count unread, when. A row opens
// the thread in place under it, as the chat draws one (the owner's words on the right), with the reply line and the ink
// Send; Done in words on an open problem. Opening a thread reads it. Read again every so often. `None` when none.

const POLL_MS = 20_000;

export default function SupportInbox({ initial }: { initial: SupportInboxRow[] }) {
  const [rows, setRows] = useState(initial);
  const [open, setOpen] = useState<number | null>(null);
  const [threads, setThreads] = useState<Record<number, SupportLine[]>>({});
  const [pending, setPending] = useState<SupportPending[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The coach's lines in an open thread are read: here at once, on the server after.
  const markSeen = (coachId: number) => {
    setRows((rs) => rs.map((r) => (r.coachId === coachId ? { ...r, unread: 0 } : r)));
    setThreads((t) => (t[coachId] ? { ...t, [coachId]: t[coachId].map((l) => (l.unread ? { ...l, unread: false } : l)) } : t));
    markSupportThreadSeenAction(coachId).catch(() => {});
  };

  const loadThread = (coachId: number) =>
    loadSupportThreadForOwnerAction(coachId).then(
      (lines) => {
        if (!lines) return;
        setThreads((t) => ({ ...t, [coachId]: lines }));
        if (lines.some((l) => l.unread)) markSeen(coachId);
      },
      () => {}
    );

  const toggle = (coachId: number) => {
    // A reply on its way stays in its own thread: its faded line, and its words back on its line if it fails.
    if (busy) return;
    setError(null);
    if (open === coachId) return setOpen(null);
    setOpen(coachId);
    setText("");
    void loadThread(coachId);
  };

  // Read again every so often while the tab is visible: the list, and the thread that is open.
  const poll = useRef(() => {});
  useEffect(() => {
    poll.current = () => {
      if (busy) return;
      loadSupportInboxAction().then((next) => setRows(open == null ? next : next.map((r) => (r.coachId === open ? { ...r, unread: 0 } : r))), () => {});
      if (open != null) void loadThread(open);
    };
  });
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") poll.current();
    };
    const t = window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  const reply = (coachId: number) => {
    const words = text.trim();
    if (!words || busy) return;
    const key = `p${Date.now()}`;
    setBusy(true);
    setError(null);
    setPending((p) => [...p, { key, text: words }]);
    setText("");
    replySupportAction(coachId, words)
      .then(
        (lines) => {
          if (!lines) {
            setError("Not sent. Try again.");
            setText(words);
            return;
          }
          setThreads((t) => ({ ...t, [coachId]: lines }));
          const last = lines[lines.length - 1];
          setRows((rs) => {
            const row = rs.find((r) => r.coachId === coachId);
            if (!row || !last) return rs;
            const moved = { ...row, last: last.text, lastFrom: "owner" as const, when: last.time, at: new Date().toISOString(), unread: 0 };
            return [moved, ...rs.filter((r) => r.coachId !== coachId)];
          });
        },
        () => {
          setError("Not sent. Check your connection and try again.");
          setText(words);
        }
      )
      .finally(() => {
        setBusy(false);
        setPending((p) => p.filter((x) => x.key !== key));
      });
  };

  const done = (coachId: number, id: number) => {
    // Closed here at once; the server's thread follows.
    setThreads((t) => ({ ...t, [coachId]: (t[coachId] ?? []).map((l) => (l.id === id ? { ...l, done: true } : l)) }));
    setRows((rs) => rs.map((r) => (r.coachId === coachId ? { ...r, problems: Math.max(0, r.problems - 1) } : r)));
    markSupportProblemDoneAction(id).then(
      (lines) => lines && setThreads((t) => ({ ...t, [coachId]: lines })),
      () => setError("Not saved. Try again.")
    );
  };

  return (
    <section className="rls-section">
      <div className="trn-weekhead">
        <div>
          <h2>Support</h2>
        </div>
      </div>
      <div className="rls-card rco-card sup-inbox">
        {rows.length === 0 ? (
          <p className="rls-none">None</p>
        ) : (
          rows.map((r) => {
            const isOpen = open === r.coachId;
            const lines = threads[r.coachId];
            return (
              <div key={r.coachId} className={`sup-irow${isOpen ? " open" : ""}${r.unread ? " unread" : ""}`}>
                <button type="button" className="sup-ihead" onClick={() => toggle(r.coachId)} aria-expanded={isOpen}>
                  <span className="sup-face" aria-hidden="true">
                    {r.avatarPath ? (
                      // eslint-disable-next-line @next/next/no-img-element -- the coach's own upload, served by the app
                      <img src={pic(r.avatarPath, 96)} alt="" loading="lazy" decoding="async" />
                    ) : (
                      r.name.charAt(0).toUpperCase()
                    )}
                  </span>
                  <b className="sup-iname">{r.name}</b>
                  <Fold open={isOpen} />
                  <span className="sup-ilast">{r.last}</span>
                  {r.problems > 0 && <span className="trn-state warn sup-iprob">{`${r.problems} problem${r.problems === 1 ? "" : "s"}`}</span>}
                  {r.unread > 0 && (
                    <span className="sup-icount" aria-label={`${r.unread} unread`}>
                      {r.unread}
                    </span>
                  )}
                  <span className="sup-iwhen">{r.when}</span>
                </button>
                {isOpen && (
                  <div className="sup-ibody">
                    {lines && <SupportThread lines={lines} pending={pending} onDone={(id) => done(r.coachId, id)} />}
                    <SupportLineBox value={text} onChange={setText} onSend={() => reply(r.coachId)} placeholder={`Reply to ${r.name}`} label={`Reply to ${r.name}`} busy={busy} />
                    {error && (
                      <p className="sup-err" role="alert">
                        {error}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
