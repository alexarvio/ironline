"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

// A chat's pictures and videos as both sides draw them (21 Oct, Alex: they
// loaded slowly): a picture at the size it is shown, never the phone's
// original, and a video behind its poster, so none of it is fetched until it
// plays. Shared by the client's chat, the coach's panel and the gallery.
// Deliberately does NOT import from ../lib/queries (see ChatComposeForm.tsx).

/** A picture at this width: the uploads route makes it at the send; a phone photo is several MB. */
export const sized = (src: string, w: number) => (src.startsWith("/uploads/") ? `${src}${src.includes("?") ? "&" : "?"}w=${w}` : src);

/** A video's first frame as a small picture, made at the send. */
const posterOf = (src: string) => (src.startsWith("/uploads/") ? `${src}${src.includes("?") ? "&" : "?"}poster=1` : null);

/** What a picture or video looks like before it loads (25 Oct, Alex: "as WhatsApp"): its size and a tiny blurry preview. */
export type MediaLook = { thumb?: string | null; w?: number | null; h?: number | null };
/** The bubble at its size from the start, the preview behind it until the picture is in, so a thread never jumps. */
const lookStyle = (look?: MediaLook | null): CSSProperties | undefined => {
  if (!look) return undefined;
  const s: CSSProperties = {};
  if (look.w && look.h) s.aspectRatio = `${look.w} / ${look.h}`;
  if (look.thumb) {
    s.backgroundImage = `url(${look.thumb})`;
    s.backgroundSize = "cover";
    s.backgroundPosition = "center";
  }
  return Object.keys(s).length ? s : undefined;
};

/** A chat's picture: 1080 wide, at its size from the start over its preview. */
export function ChatImage({ src, className, look }: { src: string; className?: string; look?: MediaLook | null }) {
  // eslint-disable-next-line @next/next/no-img-element -- an upload served by the app's own route
  return <img className={className} src={sized(src, 1080)} alt="" decoding="async" style={lookStyle(look)} />;
}

// ---- A video on screen comes down before it is tapped (25 Oct, Alex: "as much smoothness as possible"): only its
// small web copy (a few MB, "-web.mp4"), through the app so the page may read it, kept as a blob the full screen plays
// at once. The last few only.
const ready = new Map<string, string>();
const coming = new Set<string>();
function preloadVideo(src: string) {
  if (ready.has(src) || coming.has(src) || !/-web\.mp4$/i.test(src)) return;
  coming.add(src);
  fetch(`${src}?stream=1`)
    .then((r) => (r.ok ? r.blob() : null))
    .then((b) => {
      if (!b) return;
      ready.set(src, URL.createObjectURL(b));
      while (ready.size > 6) {
        const [oldest, url] = ready.entries().next().value as [string, string];
        URL.revokeObjectURL(url);
        ready.delete(oldest);
      }
    })
    .catch(() => {})
    .finally(() => coming.delete(src));
}


export function ChatVideo({ src, className, controls = true, look }: { src: string; className?: string; controls?: boolean; muted?: boolean; look?: MediaLook | null }) {
  const poster = posterOf(src);
  // No poster to be had (no ffmpeg on the server, a file it can't read): the old way, the video's own first frame.
  const [own, setOwn] = useState(!poster);
  // A poster not there yet (being made after a send or a start) is asked for again, twice, a few seconds apart, before
  // the tile stays (25 Oct, Alex: a failed one stayed blank until a reload).
  const [tries, setTries] = useState(0);
  const missed = () => {
    if (tries >= 2) return setOwn(true);
    setOwn(true);
    setTimeout(() => {
      setTries((t) => t + 1);
      setOwn(false);
    }, 3000 * (tries + 1));
  };
  const posterSrc = poster && tries > 0 ? `${poster}&r=${tries}` : poster;
  const [full, setFull] = useState(false);
  // In the message only its poster, a small picture (25 Oct, Alex: "5 seconds for the media to load"; /api/timing
  // showed every video of the thread fetched from the bucket at once on opening, to draw a frame of each). The video
  // itself loads on a tap, playing on the whole screen. The poster failing, its preview or a dark tile, never the video
  // itself (25 Oct, Alex: 23 s; /api/timing showed the whole phone originals fetched to draw a frame).
  const still = own ? (
    <span className={`${className ?? ""} cmv-blank`} style={lookStyle(look)} />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element -- an upload served by the app's own route
    <img className={className} src={posterSrc!} alt="" decoding="async" onError={missed} style={lookStyle(look)} />
  );
  // Once it is on screen, its small copy comes down, so a tap plays at once.
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el || !controls || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      preloadVideo(src);
      io.disconnect();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [src, controls]);
  if (!controls) return still;
  // In a chat a video plays on the whole screen (25 Oct, Alex: "so the client can properly see… what the coach is
  // drawing"), an ✕ to leave it; in the message it is its first frame with the play mark. Every chat draws it so.
  return (
    <>
      <span className="cmv" ref={box}>
        {still}
        <button
          type="button"
          className="cmv-play"
          onClick={(e) => {
            e.stopPropagation();
            setFull(true);
          }}
          aria-label="Play the video"
        >
          <span aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M8 5.5v13l11-6.5z" />
            </svg>
          </span>
        </button>
      </span>
      {full && typeof document !== "undefined" && createPortal(<FullVideo src={src} onClose={() => setFull(false)} />, document.body)}
    </>
  );
}

/** A chat's video on the whole screen, playing, with its own controls and an ✕ (Esc too). */
function FullVideo({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <div className="cmv-full" role="dialog" aria-modal="true" aria-label="Video" onClick={(e) => e.stopPropagation()}>
      <video src={ready.get(src) ?? src} autoPlay controls playsInline />
      <button type="button" className="cmv-x" onClick={onClose} aria-label="Close the video">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}

/**
 * A video's first frame taken on the sender's own device, as WhatsApp does (25 Oct, Alex: the boxes stayed black; the
 * server could not make one): a JPEG 720 wide at most, sent with the video as "poster". Null when the browser can't
 * read the video in a few seconds; the server then makes one itself if it can.
 */
export function videoFrame(file: File): Promise<Blob | null> {
  if (typeof document === "undefined" || !file.type.startsWith("video/")) return Promise.resolve(null);
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    let done = false;
    const finish = (b: Blob | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      v.removeAttribute("src");
      v.load();
      resolve(b);
    };
    const timer = setTimeout(() => finish(null), 5000);
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.onloadeddata = () => {
      v.currentTime = Math.min(0.1, (v.duration || 1) / 2);
    };
    v.onseeked = () => {
      try {
        const k = Math.min(1, 720 / Math.max(v.videoWidth || 1, 1));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round((v.videoWidth || 720) * k));
        c.height = Math.max(1, Math.round((v.videoHeight || 720) * k));
        c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
        c.toBlob((b) => finish(b), "image/jpeg", 0.8);
      } catch {
        finish(null);
      }
    };
    v.onerror = () => finish(null);
    v.src = url;
  });
}

/** The chat send's FormData with the video's first frame added, when it is a video and one can be had. */
export async function withVideoFrame(fd: FormData, file: File): Promise<FormData> {
  const frame = await videoFrame(file);
  if (frame) fd.set("poster", new File([frame], "poster.jpg", { type: "image/jpeg" }));
  return fd;
}
