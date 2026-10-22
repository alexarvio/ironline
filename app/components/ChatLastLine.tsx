// A chat's last message in a list of chats (22 Oct, Alex): a photo, video, voice message or file shows its icon, then
// the words sent with it, or with none the kind's name ("Photo", "Video"). One source for the coach's laptop (the
// All chats list) and phone (/coach). Icons as design rules 5: stroke 1.6, round, no fills.

export type ChatMediaKind = "image" | "video" | "audio" | "file";

export const MEDIA_NAME: Record<ChatMediaKind, string> = { image: "Photo", video: "Video", audio: "Voice message", file: "File" };

/** The kinds' icons, one copy: the coach's phone draws its photo, video, mic and file icons from these too (app/coach/parts.tsx). */
export const MEDIA_PATHS: Record<ChatMediaKind, string> = {
  image: "M4 7a2.5 2.5 0 0 1 2.5-2.5h11A2.5 2.5 0 0 1 20 7v10a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17zM4.5 16l4.5-4.5 3.5 3 3-2.5 4 3.5M9 10.2a1.3 1.3 0 1 0 0-.01",
  video: "M3.5 7.5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2zM15.5 10.5l5-3v9l-5-3",
  audio: "M9 6a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0zM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6",
  file: "M14 3.5H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8zM14 3.5V8h4.5",
};

/** "You: ", the kind's icon, then the first line of the words (or the kind's name). Inline, so the line's ellipsis still cuts it. */
export default function ChatLastLine({ last, empty = "No messages yet" }: { last: { text: string; mine: boolean; media?: ChatMediaKind | null } | null; empty?: string }) {
  if (!last) return <>{empty}</>;
  const media = last.media ?? null;
  const said = last.text.trim().split("\n")[0];
  const words = said || (media ? MEDIA_NAME[media] : "");
  // With words, a screen reader hears the kind before them; bare, the name says it already.
  const a11y = said && media ? { role: "img", "aria-label": `${MEDIA_NAME[media]}:` } : { "aria-hidden": true };
  return (
    <>
      {last.mine && "You: "}
      {media && (
        <svg className="chat-last-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...a11y}>
          <path d={MEDIA_PATHS[media]} />
        </svg>
      )}
      {words}
    </>
  );
}
