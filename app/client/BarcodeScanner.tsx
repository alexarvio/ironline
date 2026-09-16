"use client";

import { useEffect, useRef, useState } from "react";

// The phone's camera reading a barcode: the browser's own reader where it
// has one (Chrome on Android), a small library elsewhere (iPhones). Hands
// back the first EAN / UPC it makes out. A barcode can also be typed, for
// a camera that will not open or a code that will not read.
type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
type NativeCtor = new (opts: { formats: string[] }) => Detector;
const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];

export default function BarcodeScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const done = useRef(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stop = () => {};
    let cancelled = false;
    const finish = (code: string) => {
      if (done.current) return;
      done.current = true;
      if (navigator.vibrate) navigator.vibrate(30);
      onCode(code);
    };
    (async () => {
      const video = videoRef.current;
      if (!video) return;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      } catch {
        setError("The camera did not open. Type the barcode instead.");
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      video.srcObject = stream;
      await video.play().catch(() => {});
      const Native = (window as unknown as { BarcodeDetector?: NativeCtor }).BarcodeDetector;
      if (Native) {
        const detector = new Native({ formats: FORMATS });
        let frame = 0;
        const tick = async () => {
          if (cancelled || done.current) return;
          try {
            const found = await detector.detect(video);
            const hit = found.find((f) => /^\d{8,14}$/.test(f.rawValue));
            if (hit) return finish(hit.rawValue);
          } catch {
            /* a frame that could not be read; try the next */
          }
          frame = window.setTimeout(tick, 120);
        };
        tick();
        stop = () => window.clearTimeout(frame);
      } else {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (cancelled) return;
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromVideoElement(video, (result) => {
          const text = result?.getText();
          if (text && /^\d{8,14}$/.test(text)) finish(text);
        });
        stop = () => controls.stop();
      }
    })();
    return () => {
      cancelled = true;
      stop();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onCode]);

  return (
    <div className="fdi-scan-scrim" role="presentation" onClick={onClose}>
      <div className="fdi-scan" role="dialog" aria-modal="true" aria-label="Scan a barcode" onClick={(e) => e.stopPropagation()}>
        <div className="fdi-sheet-head">
          <span />
          <span className="fdi-sheet-title">Scan a barcode</span>
          <button type="button" className="fdi-sheet-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="fdi-scan-view">
          <video ref={videoRef} playsInline muted autoPlay />
          <span className="fdi-scan-frame" aria-hidden="true" />
        </div>
        {error ? <p className="fdi-scan-error">{error}</p> : <p className="fdi-hint">Hold the barcode inside the frame.</p>}
        <form
          className="fdi-scan-typed"
          onSubmit={(e) => {
            e.preventDefault();
            const code = typed.replace(/\D/g, "");
            if (code.length >= 8) onCode(code);
          }}
        >
          <input id="fdi-scan-typed" type="text" inputMode="numeric" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Or type the barcode" aria-label="Barcode" />
          <button type="submit" className="fdi-secondary" disabled={typed.replace(/\D/g, "").length < 8}>
            Look up
          </button>
        </form>
      </div>
    </div>
  );
}
