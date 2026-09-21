"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { removeSessionAction } from "../lib/actions";
import { ConfirmDialog } from "../components/ConfirmDeleteButton";
import { CopyIcon, MoreIcon, TrashIcon } from "../components/icons";
import { placePopover, type Placement } from "../components/popover";
import { CopyDayDialog, type CopyDayProps } from "./CopyDayMenu";

const WIDTH = 196;

// What can be done to a session, behind ⋯ at the end of its row: duplicate
// it, or delete it. They were a Copy button and a bin on the row itself,
// which is a lot of furniture on a line that is read far more often than it
// is acted on. Each item opens the same dialog it always did.
//
// The menu is fixed and portalled (components/popover.ts): the builder sits
// inside .ad-main, which scrolls and would clip it.
export default function SessionMenu({
  programDayId,
  sessionName,
  copy,
}: {
  programDayId: number;
  sessionName: string;
  /** What Duplicate needs; null when the session has nothing in it to copy. */
  copy: CopyDayProps | null;
}) {
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<"copy" | "delete" | null>(null);
  const [pos, setPos] = useState<Placement | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  // A click elsewhere or Escape closes it; so does scrolling, since a fixed
  // menu would otherwise stay put while its row moves away underneath.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !btn.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const close = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const pick = (which: "copy" | "delete") => {
    setOpen(false);
    setDialog(which);
  };

  return (
    <>
      <button
        ref={btn}
        type="button"
        className={`row-icon-btn pb-session-more${open ? " on" : ""}`}
        aria-label={`More for ${sessionName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          if (!open) setPos(placePopover(btn.current, { width: WIDTH, align: "right", maxHeight: 160, minHeight: 80 }));
          setOpen((o) => !o);
        }}
      >
        <MoreIcon />
      </button>

      {open &&
        createPortal(
          <div ref={panel} className="pb-session-menu" role="menu" aria-label={sessionName} style={{ ...(pos ?? {}), width: WIDTH }}>
            {copy && (
              <button type="button" role="menuitem" onClick={() => pick("copy")}>
                <CopyIcon />
                Duplicate session
              </button>
            )}
            <button type="button" role="menuitem" className="danger" onClick={() => pick("delete")}>
              <TrashIcon />
              Delete session
            </button>
          </div>,
          document.body
        )}

      {dialog === "copy" && copy && <CopyDayDialog {...copy} onClose={() => setDialog(null)} />}
      {dialog === "delete" &&
        createPortal(
          <ConfirmDialog
            action={removeSessionAction}
            hiddenFields={{ programDayId }}
            label={`Delete ${sessionName}`}
            description="The session goes, with its exercises, cardio and anything the client logged on them. The sessions after it move up."
            onClose={() => setDialog(null)}
          />,
          document.body
        )}
    </>
  );
}
