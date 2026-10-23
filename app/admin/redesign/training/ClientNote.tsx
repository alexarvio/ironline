import type React from "react";
import { ChatIcon } from "../../../components/icons";

/**
 * The client's words in an opened session (23 Oct, Alex: the pale blue band and navy Reply were the old way), in the
 * hairline voice of Lifestyle's check-ins and Nutrition's log: no band, no tint; the chat icon, `{First} wrote` in
 * grey, their words in quotes, Reply as theirs (the small ink pill) when there is one. Styles `.rd-cnote` (draft.css).
 */
export default function ClientNote({ who, children, onReply }: { who: string; children: React.ReactNode; onReply?: () => void }) {
  return (
    <div className="rd-cnote">
      <span className="rd-cnote-icon" aria-hidden="true">
        <ChatIcon />
      </span>
      <span className="rd-cnote-body">
        <span className="rd-cnote-who">{who}</span> <span className="rd-cnote-words">{children}</span>
      </span>
      {onReply && (
        <button type="button" className="rd-cnote-reply" onClick={onReply}>
          Reply
        </button>
      )}
    </div>
  );
}
