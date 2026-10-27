import { getRequestUser } from "../../../lib/auth";
import { onChatChange } from "../../../lib/chatBus";
import { coachOwnsClient } from "../../../lib/tenancy";

// Chats in real time (27 Oct, Alex): one open line a screen (server-sent events). It says which chat changed and its
// revision, nothing of what was said; the screen then asks for its own thread as it always has, so who may read what
// stays with the thread actions. A coach hears every chat of their own clients (the chat list, the phone's inbox, the
// client's phone preview), a client their own. A comment every 25 s keeps the line open through proxies; the browser
// opens it again by itself if it drops.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BEAT_MS = 25_000;

export async function GET(request: Request) {
  // From the request: the proxy does not run here, so Clerk's auth() cannot (12 Oct).
  const user = await getRequestUser(request);
  if (!user || user.must_change_password || user.pending) return new Response("Not found", { status: 404 });
  const hears = user.role === "coach" ? (clientId: number) => coachOwnsClient(user.id, clientId) : (clientId: number) => clientId === user.client_id;

  const encoder = new TextEncoder();
  // Closed once (the screen left, the line dropped): nothing is written after, and the listener and the beat go at
  // once (27 Oct: writing to a line already closed threw outside the request).
  let closed = false;
  let off = () => {};
  let beat: ReturnType<typeof setInterval> | null = null;
  const end = () => {
    if (closed) return;
    closed = true;
    off();
    if (beat) clearInterval(beat);
  };
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const say = (text: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          end();
        }
      };
      // Open: the screen reads its thread once, in case something came in while it was away.
      say(`retry: 3000\nevent: hello\ndata: {}\n\n`);
      off = onChatChange((clientId, rev, typing) => {
        if (hears(clientId)) say(`data: ${JSON.stringify(typing ? { c: clientId, r: rev, t: typing } : { c: clientId, r: rev })}\n\n`);
      });
      beat = setInterval(() => say(`: beat\n\n`), BEAT_MS);
      request.signal.addEventListener("abort", () => {
        const was = closed;
        end();
        if (!was) {
          try {
            controller.close();
          } catch {}
        }
      });
    },
    cancel() {
      end();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
