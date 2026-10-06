"use client";

import type React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover";

/**
 * A small circled "?" beside a control (6 Oct): a click opens a short note
 * on how that control works. The first of these is by the notes toggle on
 * Meetings; the same one goes wherever a screen needs a word of explanation
 * without carrying it in the layout.
 */
export default function HelpTip({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-slot="help-tip"
          className="inline-flex size-[18px] shrink-0 cursor-pointer items-center justify-center rounded-full border border-border bg-background text-[11px] font-bold leading-none text-muted-foreground outline-none hover:border-ring hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/30 data-[state=open]:border-ring data-[state=open]:text-primary"
          aria-label={`What is this? ${title}`}
        >
          ?
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="w-80">
        <b className="mb-1.5 block text-[13px] font-bold text-foreground">{title}</b>
        <div className="text-[12.5px] leading-relaxed text-muted-foreground [&_b]:font-bold [&_b]:text-foreground [&_p]:m-0 [&_p+p]:mt-1.5">{children}</div>
      </PopoverContent>
    </Popover>
  );
}
