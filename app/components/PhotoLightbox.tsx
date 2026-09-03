"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

// Full-size view of one photo. Click the backdrop or press Escape to close.
// Shared by the coach's period rows and the client's tiles.
export default function PhotoLightbox({
  src,
  caption,
  onClose,
}: {
  src: string;
  caption?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="lb-scrim" role="dialog" aria-modal="true" aria-label={caption ?? "Photo"} onMouseDown={onClose}>
      <figure className="lb-figure" onMouseDown={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element -- uploaded file */}
        <img src={src} alt={caption ?? ""} className="lb-img" />
        {caption && <figcaption className="lb-caption">{caption}</figcaption>}
        <button type="button" className="lb-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </figure>
    </div>,
    document.body
  );
}
