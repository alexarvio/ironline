"use client";

import { useFormStatus } from "react-dom";

// useFormStatus only reports pending state for the nearest ancestor <form>,
// which means it has to live in its own component below the <form> — the
// component that renders the <form> itself can't call it. Swaps to
// pendingText and disables itself while the action is in flight, so a
// multi-second server action (like the real Claude API call in report
// generation) doesn't look like the click did nothing.
export default function SubmitButton({
  children,
  pendingText,
  className = "btn",
  disabled = false,
}: {
  children: React.ReactNode;
  pendingText: string;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button className={className} type="submit" disabled={disabled || pending}>
      {pending ? pendingText : children}
    </button>
  );
}
