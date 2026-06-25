import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "World Cup 2026 — JST Tracker",
  description:
    "World Cup 2026 fixtures in Japan time (JST), live scores, and where to watch (Chilevisión / BBC iPlayer).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
