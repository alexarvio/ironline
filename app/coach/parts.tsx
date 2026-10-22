"use client";

import { Fragment, useEffect, useRef, type ReactNode } from "react";
import { MEDIA_PATHS } from "../components/ChatLastLine";

// The small pieces every screen of the coach's phone shares: the icons
// (stroke 1.6, round, no fills; design rules 5), a face, facts parted by a
// drawn bar, and the bottom sheet.

const PATHS = {
  chat: "M20 11.5a8 8 0 0 1-11.6 7.1L4 20l1.4-4.1A8 8 0 1 1 20 11.5z",
  video: MEDIA_PATHS.video,
  search: "M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM20 20l-4.8-4.8",
  photo: MEDIA_PATHS.image,
  mic: MEDIA_PATHS.audio,
  micoff: "M9 6a3 3 0 0 1 6 0v5a3 3 0 0 1-.4 1.5M5.5 11a6.5 6.5 0 0 0 10.6 5M18.5 11a6.5 6.5 0 0 1-.4 2.2M12 17.5V21M9 21h6M4 4l16 16",
  file: MEDIA_PATHS.file,
  play: "M8 5.5v13l10.5-6.5z",
  pause: "M8.5 5.5v13M15.5 5.5v13",
  back: "M15 5l-7 7 7 7",
  plus: "M12 5v14M5 12h14",
  send: "M12 19V5M6 11l6-6 6 6",
  pin: "M14.5 4l5.5 5.5-2.5 1-3.5 3.5.5 4-1.5 1.5-4-4L5 19.5l-.5-.5 4-4-4-4L6 9.5l4 .5L13.5 6.5z",
  x: "M6 6l12 12M18 6L6 18",
  pen: "M4.5 19.5l1-4L16 5a2.1 2.1 0 0 1 3 3L8.5 18.5zM14 7l3 3",
  arrow: "M5 19L19 5M10 5h9v9",
  circle: "M12 4a8 8 0 1 0 0 16 8 8 0 1 0 0-16z",
  undo: "M9 14L4.5 9.5 9 5M4.5 9.5H14a5.5 5.5 0 0 1 0 11h-2",
  link: "M10 13.5a4.5 4.5 0 0 0 6.4.4l2.6-2.6a4.5 4.5 0 0 0-6.4-6.4L11.2 6.3M14 10.5a4.5 4.5 0 0 0-6.4-.4L5 12.7a4.5 4.5 0 0 0 6.4 6.4l1.4-1.4",
  reply: "M9.5 7L4.5 12l5 5M5 12h9.5a5 5 0 0 1 5 5v1",
  copy: "M9 9h9.5v10.5H9zM15 9V5.5H5.5V15H9",
  edit: "M4.5 19.5l1-4L16 5a2.1 2.1 0 0 1 3 3L8.5 18.5zM14 7l3 3",
  trash: "M5 7h14M10 4h4M7 7l.8 12.5h8.4L17 7M10.5 11v5M13.5 11v5",
  check: "M5 12.5l4.5 4.5L19 7.5",
  calendar: "M5 5.5h14v14H5zM5 9.5h14M9 3.5v4M15 3.5v4",
  forward: "M9 5l7 7-7 7",
} as const;
export type IconName = keyof typeof PATHS;

export function Icon({ name, small = false, size }: { name: IconName; small?: boolean; size?: number }) {
  const s = size ?? (small ? 14 : 20);
  return (
    <svg className="cph-ico" viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

/** The client's (or coach's) face, else their first letter. */
export function Avatar({ name, src, size }: { name: string; src: string | null; size: number }) {
  return (
    <span className="cph-av" style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }} aria-hidden="true">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- their own upload, served by the app
        <img src={src} alt="" />
      ) : (
        (name.trim().charAt(0) || "?").toUpperCase()
      )}
    </span>
  );
}

/** Facts in a row, parted by a short drawn bar, never a dot (design rules 6); empty ones drop out. */
export function Facts({ parts }: { parts: ReactNode[] }) {
  const shown = parts.filter((p) => p != null && p !== false && p !== "");
  return (
    <>
      {shown.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <span className="cph-sep">
              <span className="cph-sr">, </span>
            </span>
          )}
          {p}
        </Fragment>
      ))}
    </>
  );
}

/** A plain white sheet from the bottom over a dimmed screen; a tap outside or Esc closes it. */
export function Sheet({ children, onClose, label, className }: { children: ReactNode; onClose: () => void; label: string; /** "tall": a long sheet that scrolls inside. */ className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close.current();
    window.addEventListener("keydown", onKey);
    box.current?.focus({ preventScroll: true });
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div className="cph-scrim" onClick={onClose}>
      <div ref={box} className={`cph-sheet${className ? ` ${className}` : ""}`} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <span className="cph-sheet-grip" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}
