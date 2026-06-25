"use client";

import { useEffect } from "react";

// Registers the service worker so the app is installable (Chrome requires a
// registered SW with a fetch handler) and works offline. Production only —
// a SW in `next dev` interferes with hot reload.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* registration is best-effort; the app works without it */
      });
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);
  return null;
}
