"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "../../components/ui/basics";

// "Take a tour", from the welcome steps (?tour=1): the rail explained one
// part at a time. The part is lit (the rest of the screen dims) and a card
// beside it says what it is for; Next, Back, or Skip. Leaving it drops
// ?tour from the address so a reload doesn't start it again.

const STEPS: { find: string; title: string; text: string }[] = [
  { find: '.rr-nav a[href="/admin/redesign/feed"]', title: "Feed", text: "Everything your clients log, newest first, one kind at a time. The number shows how many clients need you." },
  { find: '.rr-nav a[href="/admin/redesign/calendar"]', title: "Calendar", text: "Your calls with clients and your own time, a month at a time." },
  { find: '.rr-nav a[href="/admin/redesign/phases"]', title: "Phases", text: "Every client's plan side by side: training, nutrition and lifestyle phases." },
  { find: '.rr-nav a[href="/admin/redesign/business"]', title: "Business", text: "How the business is doing: clients, revenue, and what's still outstanding." },
  { find: ".rr-clients-head", title: "Your clients", text: "Everyone you coach. A dot means something needs you; Needs you shows just those." },
  { find: ".rr-new", title: "New client", text: "Add a client here. They get an email with a link to join the app." },
  { find: ".rr-coach", title: "You", text: "Your profile, business details and invoicing, whenever you want to change them." },
];

export default function RailTour() {
  const router = useRouter();
  const path = usePathname();
  const [at, setAt] = useState(0);
  const [box, setBox] = useState<DOMRect | null>(null);
  const step = STEPS[at];

  // Where the part is on screen, kept up to date as the window changes.
  useLayoutEffect(() => {
    const measure = () => setBox(document.querySelector(step.find)?.getBoundingClientRect() ?? null);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [step.find]);

  const end = () => router.replace(path, { scroll: false });
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && end();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- end only reads the path
  }, [path]);

  if (!box) return null;
  const pad = 6;
  const top = Math.max(16, Math.min(box.top - 8, window.innerHeight - 230));
  return (
    <div className="rtour" role="dialog" aria-modal="true" aria-label={`Tour: ${step.title}`}>
      <div className="rtour-lit" style={{ top: box.top - pad, left: box.left - pad, width: box.width + pad * 2, height: box.height + pad * 2 }} />
      <div className="rtour-card" style={{ top, left: box.right + 22 }}>
        <span className="rtour-count">
          {at + 1}/{STEPS.length}
        </span>
        <b className="rtour-title">{step.title}</b>
        <p className="rtour-text">{step.text}</p>
        <div className="rtour-actions">
          <Button type="button" variant="ghost" size="sm" onClick={end}>
            Skip
          </Button>
          <span className="rtour-go">
            {at > 0 && (
              <Button type="button" variant="outline" size="sm" onClick={() => setAt(at - 1)}>
                Back
              </Button>
            )}
            <Button type="button" size="sm" onClick={() => (at < STEPS.length - 1 ? setAt(at + 1) : end())}>
              {at < STEPS.length - 1 ? "Next" : "Done"}
            </Button>
          </span>
        </div>
      </div>
    </div>
  );
}
