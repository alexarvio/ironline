"use client";

import { useRef, useState } from "react";

// "Swipe to end session": a handle dragged along a navy track. Past most of
// the way it locks, the track turns green and the session ends; let go
// earlier and it springs back. Works with a finger and a mouse (pointer
// events, captured), and from the keyboard: hold Enter or Space on the
// handle to confirm.
const HANDLE = 52;
const INSET = 4;
const HOLD_MS = 600;

export default function SwipeToEnd({ onEnd, done }: { onEnd: () => void; done: boolean }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [locked, setLocked] = useState(false);
  const [lockX, setLockX] = useState(0);
  const startX = useRef(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const travel = () => Math.max(1, (trackRef.current?.clientWidth ?? 0) - HANDLE - INSET * 2);
  const finish = () => {
    setLocked(true);
    setLockX(travel());
    setX(0);
    onEnd();
  };
  const onDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (locked || done) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    startX.current = e.clientX - x;
    setDragging(true);
  };
  const onMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragging || locked) return;
    setX(Math.min(travel(), Math.max(0, e.clientX - startX.current)));
  };
  const onUp = () => {
    if (!dragging || locked) return;
    setDragging(false);
    if (x >= travel() * 0.88) finish();
    else setX(0);
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    if (locked || holdTimer.current) return;
    setX(travel() * 0.5);
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      finish();
    }, HOLD_MS);
  };
  const onKeyUp = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
      if (!locked) setX(0);
    }
  };
  const isLocked = locked || done;
  const fade = isLocked ? 1 : Math.max(0.15, 1 - x / 200);
  return (
    <div ref={trackRef} className={`wo-swipe${isLocked ? " locked" : ""}${dragging ? " dragging" : ""}`}>
      <span className="wo-swipe-fill" style={{ width: isLocked ? "100%" : `${x + HANDLE + INSET}px` }} aria-hidden="true" />
      <span className="wo-swipe-label" style={{ opacity: fade }}>
        {isLocked ? "Session saved" : "Swipe to end session"}
      </span>
      <button
        type="button"
        className="wo-swipe-handle"
        style={isLocked ? { transform: `translateX(${lockX}px)` } : { transform: `translateX(${x}px)` }}
        aria-label="Swipe to end session"
        disabled={isLocked}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
      >
        {isLocked ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        )}
      </button>
    </div>
  );
}
