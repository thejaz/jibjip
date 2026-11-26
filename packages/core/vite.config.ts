import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readAppVersion } from "../../scripts/app-version.mjs";
import { brandAssetFingerprint } from "../../scripts/verify_brand_assets.mjs";
import { BROWSER_TARGETS } from "../../scripts/browser-targets.mjs";

export default defineConfig({
  resolve: { preserveSymlinks: true, dedupe: ["react", "react-dom"] },
  publicDir: false,
  plugins: [react()],
  define: {
    __JIBJIP_APP_VERSION__: JSON.stringify(readAppVersion(resolve("."))),
    __JIBJIP_BRAND_VERSION__: JSON.stringify(brandAssetFingerprint(resolve("."))),
  },
  build: {
    target: BROWSER_TARGETS, cssTarget: BROWSER_TARGETS,
    lib: { entry: resolve("packages/core/src/index.ts"), formats: ["es"], fileName: () => "index.js", cssFileName: "style" },
    outDir: "packages/core/dist",
    emptyOutDir: true,
    sourcemap: false,
    rolldownOptions: { external: [/^react(?:\/|$)/, /^react-dom(?:\/|$)/, "dexie", "decimal.js", "lucide-react"] },
  },
});
