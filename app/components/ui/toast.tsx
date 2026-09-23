"use client";

import { Toaster as Sonner, toast } from "sonner";

// One place for the small message that slides in at the corner and goes by
// itself: "Saved", "Couldn't save", "Removed · Undo". Mounted once by the
// admin shell; anything that saves calls notify.
export function Toaster() {
  return <Sonner position="bottom-right" duration={3500} closeButton={false} />;
}

export const notify = {
  saved: (what?: string) => toast.success("Saved", what ? { description: what } : undefined),
  failed: (what = "Check your connection and try again.") => toast.error("Couldn't save", { description: what }),
  done: (title: string, description?: string) => toast(title, description ? { description } : undefined),
  undo: (title: string, onUndo: () => void) => toast(title, { action: { label: "Undo", onClick: onUndo } }),
};
