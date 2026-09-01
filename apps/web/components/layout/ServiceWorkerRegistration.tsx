"use client";

import { useEffect } from "react";

/**
 * Registers the service worker that makes the app installable and lets a
 * reload survive a lost connection.
 *
 * Registered after load rather than during it: the worker's job starts on the
 * *next* visit, so competing with the first paint for bandwidth buys nothing.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    // Dev serves assets that the worker's cache assumptions do not hold for,
    // and a stale worker is a confusing thing to debug through.
    if (process.env.NODE_ENV !== "production") {
      return;
    }

    let cancelled = false;

    function register() {
      if (cancelled) {
        return;
      }
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // An unavailable worker costs the offline page and nothing else.
      });
    }

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }

    return () => {
      cancelled = true;
      window.removeEventListener("load", register);
    };
  }, []);

  return null;
}
