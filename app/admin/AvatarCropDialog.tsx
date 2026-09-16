"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Framing the coach's profile picture before it uploads: the photo sits in a
// square frame with a round window over it, drag to move it, a slider to
// zoom. "Use photo" cuts the square out at 512 px and hands it back as a
// JPEG, so what is stored is exactly the circle the clients will see.
const FRAME = 280;
const OUT = 512;

export default function AvatarCropDialog({ file, onCancel, onUse }: { file: File; onCancel: () => void; onUse: (cropped: File) => void }) {
  const [url] = useState(() => URL.createObjectURL(file));
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  // The image at zoom 1 just covers the frame; larger zooms scale from there.
  const base = img ? Math.max(FRAME / img.naturalWidth, FRAME / img.naturalHeight) : 1;
  const scale = base * zoom;
  const dw = (img?.naturalWidth ?? 0) * scale;
  const dh = (img?.naturalHeight ?? 0) * scale;
  const clamp = (o: { x: number; y: number }, w = dw, h = dh) => ({
    x: Math.min(0, Math.max(FRAME - w, o.x)),
    y: Math.min(0, Math.max(FRAME - h, o.y)),
  });

  const onLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget;
    const b = Math.max(FRAME / el.naturalWidth, FRAME / el.naturalHeight);
    setImg(el);
    setOffset({ x: (FRAME - el.naturalWidth * b) / 2, y: (FRAME - el.naturalHeight * b) / 2 });
  };

  // Zooming keeps whatever is at the centre of the window at the centre.
  const setZoomKeepingCentre = (z: number) => {
    if (!img) return;
    const next = base * z;
    const cx = (FRAME / 2 - offset.x) / scale;
    const cy = (FRAME / 2 - offset.y) / scale;
    setZoom(z);
    setOffset(clamp({ x: FRAME / 2 - cx * next, y: FRAME / 2 - cy * next }, img.naturalWidth * next, img.naturalHeight * next));
  };

  const use = () => {
    if (!img) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, OUT, OUT);
    const side = FRAME / scale;
    ctx.drawImage(img, -offset.x / scale, -offset.y / scale, side, side, 0, 0, OUT, OUT);
    canvas.toBlob(
      (blob) => {
        if (blob) onUse(new File([blob], "avatar.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9,
    );
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return createPortal(
    <div className="pb-modal-scrim" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="pb-modal pb-modal-sm cpe-crop" role="dialog" aria-modal="true" aria-label="Frame your profile picture">
        <div className="pb-modal-head">
          <h2 className="pb-modal-title">Frame your picture</h2>
          <button type="button" className="pb-modal-x" aria-label="Cancel" onClick={onCancel}>
            ×
          </button>
        </div>
        <p className="pb-confirm-body">Drag to move it, slide to zoom. The circle is what clients see.</p>

        <div
          className="cpe-crop-frame"
          style={{ width: FRAME, height: FRAME }}
          onPointerDown={(e) => {
            drag.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            setOffset(clamp({ x: d.ox + (e.clientX - d.px), y: d.oy + (e.clientY - d.py) }));
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- a local file, not yet uploaded */}
          <img
            src={url}
            alt=""
            draggable={false}
            onLoad={onLoad}
            style={{ width: dw || undefined, height: dh || undefined, transform: `translate(${offset.x}px, ${offset.y}px)` }}
          />
          <span className="cpe-crop-window" aria-hidden="true" />
        </div>

        <label className="cpe-crop-zoom">
          <span className="cpe-label">Zoom</span>
          <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoomKeepingCentre(Number(e.target.value))} />
        </label>

        <div className="pb-modal-foot">
          <button type="button" className="ad-btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="ad-btn-primary" onClick={use} disabled={!img}>
            Use photo
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
