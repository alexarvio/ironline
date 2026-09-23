"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { removeSessionAction } from "../lib/actions";
import { ConfirmDialog } from "../components/ConfirmDeleteButton";
import { ChatIcon, CopyIcon, MoreIcon, TrashIcon } from "../components/icons";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../components/ui/dropdown-menu";
import { MessageAboutDialog, type AboutTarget } from "./MessageAbout";
import { CopyDayDialog, type CopyDayProps } from "./CopyDayMenu";

// What can be done to a session, behind ⋯ at the end of its row: message
// the client about it, duplicate it, or delete it. They were a Copy button
// and a bin on the row itself, which is a lot of furniture on a line that is
// read far more often than it is acted on. Each item opens the same dialog
// it always did.
//
// The menu is shadcn's Dropdown Menu (components/ui): it positions itself,
// flips when there is no room below, closes on Escape, a click outside or a
// scroll, and takes the arrow keys.
export default function SessionMenu({
  programDayId,
  sessionName,
  copy,
  message = null,
}: {
  programDayId: number;
  sessionName: string;
  /** What Duplicate needs; null when the session has nothing in it to copy. */
  copy: CopyDayProps | null;
  /** Messaging the client about this session; null when they can't open it. */
  message?: AboutTarget | null;
}) {
  const [dialog, setDialog] = useState<"copy" | "delete" | "message" | null>(null);

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger className="row-icon-btn pb-session-more" aria-label={`More for ${sessionName}`}>
          <MoreIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="pb-menu" aria-label={sessionName}>
          {message && (
            <DropdownMenuItem onSelect={() => setDialog("message")}>
              <ChatIcon />
              Message about this session
            </DropdownMenuItem>
          )}
          {copy && (
            <DropdownMenuItem onSelect={() => setDialog("copy")}>
              <CopyIcon />
              Duplicate session
            </DropdownMenuItem>
          )}
          {(message || copy) && <DropdownMenuSeparator />}
          <DropdownMenuItem variant="destructive" onSelect={() => setDialog("delete")}>
            <TrashIcon />
            Delete session
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {dialog === "copy" && copy && <CopyDayDialog {...copy} onClose={() => setDialog(null)} />}
      {dialog === "message" && message && <MessageAboutDialog target={message} onClose={() => setDialog(null)} />}
      {dialog === "delete" &&
        createPortal(
          <ConfirmDialog
            action={removeSessionAction}
            hiddenFields={{ programDayId }}
            label={`Delete ${sessionName}`}
            description="The session goes, with its exercises, cardio and anything the client logged on them. The sessions after it move up."
            onClose={() => setDialog(null)}
          />,
          document.body
        )}
    </>
  );
}
