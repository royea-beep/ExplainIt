"use client";

import { useEffect } from "react";

/**
 * Client-side global error monitor.
 * Catches unhandled errors and promise rejections, logs them to console
 * and POSTs to /api/errors (fire-and-forget).
 */
export function ErrorReporter() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    let errorCount = 0;
    const MAX_ERRORS = 10; // Cap per session to avoid flooding

    function report(payload: Record<string, unknown>) {
      if (errorCount >= MAX_ERRORS) return;
      errorCount++;

      // Log locally first
      console.error("[ErrorReporter]", payload);

      // Fire-and-forget POST (non-blocking, best-effort)
      try {
        const body = JSON.stringify({
          ...payload,
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        });
        if (navigator.sendBeacon) {
          navigator.sendBeacon("/api/errors", body);
        } else {
          fetch("/api/errors", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
            keepalive: true,
          }).catch(() => {});
        }
      } catch {
        // Silently fail — error reporter must never throw
      }
    }

    function onError(event: ErrorEvent) {
      report({
        type: "error",
        message: event.message,
        source: event.filename,
        line: event.lineno,
        column: event.colno,
        stack: event.error?.stack,
      });
    }

    function onUnhandledRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      report({
        type: "unhandledrejection",
        message: reason?.message || String(reason),
        stack: reason?.stack,
      });
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
