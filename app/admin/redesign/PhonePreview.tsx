"use client";

import { useEffect, useRef, useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../components/ui/dropdown-menu";
import { ChevronDownIcon } from "../../components/icons";
import type { PhoneMessage, PhoneScreen } from "../../client/AppShell";

// The client's phone, in the panel beside the chat (21 Oct, Alex: "so the coach is not completely blind"): the client
// app itself, this client's, read-only (/client?phone=1, AppShell readOnly). It follows the coach's tab, a pick here
// shows another screen, and every save the page reads again is read again in the phone, in place.

/** The screens, in the order the client meets them. */
export const PHONE_SCREENS: { id: PhoneScreen; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "training", label: "Training" },
  { id: "nutrition", label: "Nutrition" },
  { id: "food", label: "Food diary" },
  { id: "checkin", label: "Check-in" },
  { id: "photos", label: "Progress pictures" },
  { id: "meetings", label: "Meetings" },
  { id: "events", label: "Events" },
  { id: "messages", label: "Chat" },
  { id: "invoices", label: "Invoices" },
];

/** The admin tab's screen on the phone: the one a change made there shows up on. */
export const SCREEN_FOR_TAB: Record<string, PhoneScreen> = {
  home: "home",
  plan: "home",
  measurements: "checkin",
  training: "training",
  nutrition: "nutrition",
  pictures: "photos",
  meetings: "meetings",
  invoices: "invoices",
};

// The app is drawn at an iPhone's size, then scaled to the panel; a thin ink edge for the phone.
const W = 393;
const H = 852;
const EDGE = 7;

export default function PhonePreview({
  clientId,
  firstName,
  screen,
  onScreen,
  stamp,
  active,
  onClose,
}: {
  clientId: number;
  firstName: string;
  screen: PhoneScreen;
  onScreen: (s: PhoneScreen) => void;
  /** A new object each time the page's data is read again (a save): the phone reads again too. */
  stamp: object;
  /** On screen: reads wait until the phone is looked at. */
  active: boolean;
  onClose: () => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  // Its address once, for this client; screens and reads after it go by message, so the phone keeps its place.
  const [src] = useState(() => `/client?client=${clientId}&phone=1&screen=${screen}`);
  // Counts the times the app said it listens: a reload of it starts on its address's screen, so it is told again.
  const [ready, setReady] = useState(0);
  const post = (m: Omit<PhoneMessage, "norcoach">) => frame.current?.contentWindow?.postMessage({ norcoach: "phone", ...m } satisfies PhoneMessage, window.location.origin);

  // The app says when it listens (after every load of it); from then on it is told the screen.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return;
      if ((e.data as { norcoach?: string } | null)?.norcoach === "phone-ready") setReady((n) => n + 1);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
  useEffect(() => {
    if (ready) post({ screen });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- post reads the frame
  }, [screen, ready]);
  // A save on the page: read again, once the phone is on screen.
  const read = useRef(stamp);
  useEffect(() => {
    if (!ready || !active || read.current === stamp) return;
    read.current = stamp;
    post({ refresh: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- post reads the frame
  }, [stamp, active, ready]);

  // As large as the panel allows, never larger than the phone itself.
  const stage = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.8);
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const fit = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) setScale(Math.min(1, width / (W + EDGE * 2), height / (H + EDGE * 2)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const label = PHONE_SCREENS.find((s) => s.id === screen)?.label ?? "Home";
  return (
    <div className="rd-phone">
      <div className="rd-phone-head">
        <h2 className="rd-title">{firstName}&rsquo;s app</h2>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger className="rd-phone-pick" aria-label={`Screen: ${label}`}>
            {label}
            <ChevronDownIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="pb-menu">
            {PHONE_SCREENS.map((s) => (
              <DropdownMenuItem key={s.id} className={s.id === screen ? "on" : ""} onSelect={() => onScreen(s.id)}>
                {s.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <button type="button" className="rm-panel-x" onClick={onClose} aria-label="Close" title="Close">
          ×
        </button>
      </div>
      <div className="rd-phone-stage" ref={stage}>
        <div className="rd-phone-device" style={{ width: (W + EDGE * 2) * scale, height: (H + EDGE * 2) * scale }}>
          <div className="rd-phone-scale" style={{ width: W + EDGE * 2, height: H + EDGE * 2, transform: `scale(${scale})` }}>
            {/* Out of the keyboard's way: nothing in it can be used. */}
            <iframe ref={frame} className="rd-phone-screen" src={src} title={`${firstName}'s app`} width={W} height={H} tabIndex={-1} />
          </div>
        </div>
      </div>
    </div>
  );
}
