"use client";

import type React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover";

/**
 * A small circled "?" beside a control (6 Oct): a click opens a short note
 * on how that control works. The first of these is by the notes toggle on
 * Meetings; the same one goes wherever a screen needs a word of explanation
 * without carrying it in the layout.
 */
export default function HelpTip({ title, children, wide = false, untitled = false }: { title: string; children: React.ReactNode; /** A legend that needs the room (25 Oct): 420px. */ wide?: boolean; /** The title for screen readers only (25 Oct, Alex: the legend needs none). */ untitled?: boolean }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-slot="help-tip"
          className="inline-flex size-[18px] shrink-0 cursor-pointer items-center justify-center rounded-full border border-border bg-background text-[11px] font-semibold leading-none text-muted-foreground outline-none hover:border-ring hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/30 data-[state=open]:border-ring data-[state=open]:text-primary"
          aria-label={`What is this? ${title}`}
        >
          ?
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align={wide ? "end" : "start"} className={wide ? "w-[420px]" : "w-80"}>
        {!untitled && <b className="mb-1.5 block text-[13px] font-semibold text-foreground">{title}</b>}
        <div className="text-[12.5px] leading-relaxed text-muted-foreground [&_b]:font-semibold [&_b]:text-foreground [&_p]:m-0 [&_p+p]:mt-1.5">{children}</div>
      </PopoverContent>
    </Popover>
  );
}
