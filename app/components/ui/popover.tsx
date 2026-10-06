"use client";

// shadcn/ui's Popover (new-york v4), trimmed: a small floating panel anchored
// to its trigger, for the "?" help tips and the like.
import * as React from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { cn } from "./cn";

function Popover(props: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger(props: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({ className, align = "start", sideOffset = 6, onOpenAutoFocus, onCloseAutoFocus, ...props }: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  // Closing hands focus back to what opened it, without the page scrolling to it (6 Oct).
  const opener = React.useRef<HTMLElement | null>(null);
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        onOpenAutoFocus={(e) => {
          opener.current = document.activeElement as HTMLElement | null;
          onOpenAutoFocus?.(e);
        }}
        onCloseAutoFocus={(e) => {
          onCloseAutoFocus?.(e);
          if (e.defaultPrevented) return;
          e.preventDefault();
          opener.current?.focus?.({ preventScroll: true });
        }}
        className={cn("z-50 w-72 rounded-md border border-border bg-popover p-4 text-popover-foreground shadow-md outline-none", className)}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverTrigger, PopoverContent };
