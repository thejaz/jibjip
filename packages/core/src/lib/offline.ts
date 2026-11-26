import { runtimeProfile } from "../runtime";

type InstallEvent = Event & {
  prompt: () => Promise<{ outcome: "accepted" | "dismissed" }>;
};
export interface OfflineStatus {
  supported: boolean | null;
  online: boolean;
  ready: boolean;
  waiting: boolean;
  checking: boolean;
  downloading: boolean;
  checked: boolean;
  failed: boolean;
  installed: boolean;
  canInstall: boolean;
  storageAvailable: boolean;
  persistent: boolean;
  protectionRequested: boolean;
}
const initial: OfflineStatus = {
  supported: null, online: true, ready: false, waiting: false, checking: false,
  downloading: false, checked: false, failed: false, installed: false, canInstall: false,
  storageAvailable: false, persistent: false, protectionRequested: false,
};
let status = initial;
let started = false;
let registration: ServiceWorkerRegistration | undefined;
let pendingInstall: InstallEvent | undefined;
let lastCheck = 0;
let checking: Promise<void> | undefined;
const listeners = new Set<() => void>();
const observed = new WeakSet<ServiceWorker>();
const emit = (patch: Partial<OfflineStatus>) => {
  status = { ...status, ...patch };
  listeners.forEach((listener) => listener());
};
export const getOfflineStatus = () => status;
export const getServerOfflineStatus = () => initial;
export function subscribeOfflineStatus(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function readRegistration() {
  if (!registration) return;
  const installingState = registration.installing?.state;
  const downloading = installingState === "installing" || installingState === "parsed";
  emit({ ready: registration.active?.state === "activated", waiting: !!registration.waiting, downloading, checking: !!checking || downloading });
  const worker = registration.installing;
  if (worker && !observed.has(worker)) {
    observed.add(worker);
    let installed = false;
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed") installed = true;
      // A worker that finished installing and was later superseded is not a failed update.
      if (worker.state === "redundant" && !installed) emit({ failed: true });
      readRegistration();
    });
  }
}
function observeRegistration(value: ServiceWorkerRegistration) {
  if (registration !== value) {
    registration = value;
    registration.addEventListener("updatefound", readRegistration);
  }
  readRegistration();
}

/** Standard waiting lifecycle: no forced activation or reload, even across tabs. */
export function registerOfflineShell() {
  if (started || typeof window === "undefined") return;
  started = true;
  const supported = window.isSecureContext && "serviceWorker" in navigator &&
    runtimeProfile() !== "development";
  const display = window.matchMedia("(display-mode: standalone)");
  const installed = () => display.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  emit({ supported, online: navigator.onLine, installed: installed(), storageAvailable: !!navigator.storage?.persist });
  display.addEventListener("change", () => emit({ installed: installed() }));
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    pendingInstall = event as InstallEvent;
    emit({ canInstall: true });
  });
  window.addEventListener("appinstalled", () => {
    pendingInstall = undefined;
    emit({ installed: true, canInstall: false });
  });
  window.addEventListener("offline", () => emit({ online: false }));
  window.addEventListener("online", () => { emit({ online: true }); void checkOfflineUpdates(true); });
  const checkVisible = () => { if (document.visibilityState === "visible") void checkOfflineUpdates(); };
  document.addEventListener("visibilitychange", checkVisible);
  window.addEventListener("focus", checkVisible);
  if (navigator.storage?.persisted) void navigator.storage.persisted().then((persistent) => emit({ persistent })).catch(() => undefined);
  if (!supported) return;
  navigator.serviceWorker.addEventListener("controllerchange", readRegistration);
  void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then((value) => {
    observeRegistration(value);
    void checkOfflineUpdates(true);
  }).catch(() => emit({ failed: true }));
  window.setInterval(checkVisible, 15 * 60 * 1000);
}
export function checkOfflineUpdates(force = false): Promise<void> {
  if (checking) return checking;
  if (!status.supported || !navigator.onLine || (!force && Date.now() - lastCheck < 60_000)) return Promise.resolve();
  lastCheck = Date.now();
  emit({ checking: true, failed: false });
  // Assign the promise before work starts, including the no-await initial-install path.
  checking = Promise.resolve().then(async () => {
    try {
      // Retrying registration recovers from a first visit with no usable network.
      const current = registration ?? await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      observeRegistration(current);
      if (!current.installing) await current.update();
      emit({ checked: true });
    } catch {
      emit({ failed: true });
    } finally {
      checking = undefined;
      emit({ checking: false });
      readRegistration();
    }
  });
  return checking;
}
export async function installApp(): Promise<"accepted" | "dismissed" | "failed" | "unavailable"> {
  const event = pendingInstall;
  if (!event) return "unavailable";
  pendingInstall = undefined;
  emit({ canInstall: false });
  try { return (await event.prompt()).outcome; } catch { return "failed"; }
}
export async function protectOfflineStorage() {
  let persistent = false;
  try { persistent = await navigator.storage?.persist?.() ?? false; } catch { /* Browser policy can refuse. */ }
  emit({ persistent, protectionRequested: true });
}
