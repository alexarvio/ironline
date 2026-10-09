"use client";

import { createContext, useContext } from "react";
import type { DraftLink } from "./messages/MessagesDraft";

// Replying to something the client said (a comment on an exercise, a note on
// a workout) slides the chat with them in from the right, over whichever tab
// is open (1 Oct): the reply already points at what it answers, and closing
// slides it away again. RedesignShell holds the panel; a tab asks for it here.
// Null outside the shell, so a caller keeps its own way of replying.

/** Opens the chat, about something and, when given, on one message (9 Oct). */
export type OpenChat = (about?: Pick<DraftLink, "area" | "label" | "link"> | null, focus?: number | null) => void;

export const OpenChatContext = createContext<OpenChat | null>(null);

export const useOpenChat = () => useContext(OpenChatContext);
