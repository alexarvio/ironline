"use client";

import type { ReactNode } from "react";
import NewClientDialog, { type NewClientPreview } from "../../NewClientDialog";

// A screen on the board looks and types like the real one, but nothing on
// it sends: a form doesn't submit and a link doesn't leave.
export default function DemoFrame({ children }: { children: ReactNode }) {
  return (
    <div
      className="ob-demo"
      onSubmitCapture={(e) => e.preventDefault()}
      onClickCapture={(e) => {
        if ((e.target as HTMLElement).closest("a[href]")) e.preventDefault();
      }}
    >
      {children}
    </div>
  );
}

/** The New client dialog open on a step, with nothing behind the buttons. */
export function DialogScreen({ preview, inviteReady }: { preview: NewClientPreview; inviteReady: boolean }) {
  return <NewClientDialog preview={preview} inviteReady={inviteReady} onClose={() => {}} />;
}
