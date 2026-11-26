export const SERVICE_WORKER_CACHE_VERSION_TOKEN = "__JIBJIP_CACHE_VERSION__";
const MANIFEST_TOKEN = "/* __JIBJIP_PRECACHE_MANIFEST__ */ []";

// Only public application files belong here. Financial records stay in IndexedDB.
export const OFFLINE_SHELL_PATHS = [
  "/", "/app/", "/about/", "/manifest.webmanifest", "/manifest-android.webmanifest", "/LICENSE.txt",
  "/data/jibjip-starter-seed.json",
  "/brand/jibjip-icon.svg", "/brand/jibjip-type-en.svg", "/brand/jibjip-type-fa.svg",
  "/fonts/Estedad-Variable.woff2", "/favicon.ico",
  "/audio/chick.mp3",
  "/icons/apple-touch-icon.png", "/icons/icon-192.png", "/icons/icon-512.png",
  "/icons/maskable-icon-512.png", "/icons/android-icon-192.png", "/icons/android-icon-512.png",
] as const;

/** Pin the complete release to exact bytes, including un-hashed HTML and artwork. */
export function stampServiceWorkerCache(source: string, fingerprint: string, assets: readonly string[], integrity: Readonly<Record<string, string>>): string {
  if (!/^[a-f0-9]{12,64}$/i.test(fingerprint)) throw new Error("The service-worker cache fingerprint must be a hexadecimal digest.");
  if (!source.includes(SERVICE_WORKER_CACHE_VERSION_TOKEN) || !source.includes(MANIFEST_TOKEN)) throw new Error("The service worker is missing its build placeholders.");
  if (assets.some((path) => !/^\/assets\/[^/]+\.(js|css)$/.test(path)) || new Set(assets).size !== assets.length || assets.length === 0) {
    throw new Error("Precached build assets must be unique local JavaScript or stylesheet paths.");
  }
  const paths = [...OFFLINE_SHELL_PATHS, ...assets];
  if (Object.keys(integrity).length !== paths.length || paths.some((url) => !/^sha256-[A-Za-z0-9+/]{43}=$/.test(integrity[url] ?? ""))) {
    throw new Error("Every offline file must have its exact SHA-256 integrity value.");
  }
  return source.replaceAll(SERVICE_WORKER_CACHE_VERSION_TOKEN, fingerprint.toLowerCase())
    .replace(MANIFEST_TOKEN, JSON.stringify(paths.map((url) => ({ url, integrity: integrity[url] })), null, 2));
}
