"use client";

// The browser's print sheet, which also saves as PDF.
export default function PrintButton() {
  return (
    <button type="button" className="ivp-btn primary" onClick={() => window.print()}>
      Print or save as PDF
    </button>
  );
}
