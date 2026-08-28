import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ironline",
  description: "Coach + client core loop prototype",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
