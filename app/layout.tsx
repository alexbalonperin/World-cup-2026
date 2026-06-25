import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorkerRegister from "./ServiceWorkerRegister";

export const metadata: Metadata = {
  metadataBase: new URL("https://world-cup-2026.vercel.app"),
  applicationName: "WC2026",
  title: "World Cup 2026 — JST Tracker",
  description:
    "World Cup 2026 fixtures in Japan time (JST), live scores, and where to watch (Chilevisión / BBC iPlayer).",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "WC2026",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0b1020",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
