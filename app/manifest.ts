import type { MetadataRoute } from "next";

// Served by Next.js at /manifest.webmanifest and auto-linked in <head>.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "World Cup 2026 — JST Tracker",
    short_name: "WC2026",
    description:
      "World Cup 2026 fixtures in Japan time (JST), live scores, and where to watch.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b1020",
    theme_color: "#0b1020",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
