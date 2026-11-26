import { localDate } from "./dates.ts";

const listeners = new Set<() => void>();
let day = localDate();
let timeout: number | undefined;

function schedule() {
  window.clearTimeout(timeout);
  if (!listeners.size) return;
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 50);
  timeout = window.setTimeout(refresh, midnight.getTime() - now.getTime());
}

function refresh() {
  const next = localDate();
  if (next !== day) {
    day = next;
    listeners.forEach(listener => listener());
  }
  schedule();
}

function onVisible() {
  if (document.visibilityState === "visible") refresh();
}

/** One local-midnight timer; foreground checks recover suspended tabs and clock changes. */
export function subscribeLocalDay(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    day = localDate();
    schedule();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size) return;
    window.clearTimeout(timeout);
    window.removeEventListener("focus", refresh);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
