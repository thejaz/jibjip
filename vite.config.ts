import react from "@vitejs/plugin-react";
import { createHash } from "node:crypto";
import { copyFileSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve, relative, isAbsolute } from "node:path";
import { defineConfig } from "vite";
import { OFFLINE_SHELL_PATHS, stampServiceWorkerCache } from "./packages/core/src/lib/release-cache";
import { readAppVersion } from "./scripts/app-version.mjs";
import { brandAssetFingerprint, verifyBrandAssets } from "./scripts/verify_brand_assets.mjs";
import { BROWSER_TARGETS } from "./scripts/browser-targets.mjs";

export default defineConfig(({ command, mode }) => {
  const development = command === "serve";
  if (!development && mode !== "personal" && mode !== "public") throw new Error("Build with --mode personal or --mode public.");
  const profile = development ? "development" : mode;
  const appVersion = readAppVersion(resolve("."));
  const personalOutput = process.env.JIBJIP_LOCAL_RUNTIME_OUTPUT;
  if (profile === "personal") {
    const child = personalOutput ? relative(resolve("work"), resolve(personalOutput)) : "";
    if (!child || isAbsolute(child) || child.startsWith("..") || !/^local-runtime-staging-[^/\\]+$/.test(child)) {
      throw new Error("Personal builds must use the staged local runtime builder.");
    }
  }
  const publicOutput = process.env.JIBJIP_PUBLIC_OUTPUT;
  if (publicOutput) {
    const child = relative(resolve("work"), resolve(publicOutput));
    if (isAbsolute(child) || child.startsWith("..") || !/^public-(?:staging|release)-[^/\\]+$/.test(child)) throw new Error("Unexpected public staging directory.");
  }
  const output = resolve(profile === "personal" ? personalOutput! : publicOutput ?? "work/public-candidate");
  return {
    root: "apps/web",
    publicDir: "../../packages/core/assets",
    base: "/",
    resolve: {
      preserveSymlinks: true,
      dedupe: ["react", "react-dom"],
      alias: [
        { find: "@jibjip/core/style.css", replacement: resolve(development ? "packages/core/src/styles.css" : "packages/core/dist/style.css") },
        { find: "@jibjip/core", replacement: resolve(development ? "packages/core/src/index.ts" : "packages/core/dist/index.js") },
      ],
    },
    define: {
      __JIBJIP_RUNTIME_PROFILE__: JSON.stringify(profile),
      __JIBJIP_APP_VERSION__: JSON.stringify(appVersion),
      __JIBJIP_BRAND_VERSION__: JSON.stringify(brandAssetFingerprint(resolve("."))),
    },
    plugins: [react(), {
      name: "jibjip-release",
      apply: "build",
      buildStart() { verifyBrandAssets(resolve(".")); },
      closeBundle() {
        copyFileSync(resolve("LICENSE"), resolve(output, "LICENSE.txt"));
        if (profile === "public") {
          writeFileSync(resolve(output, "robots.txt"), "User-agent: *\nAllow: /\nDisallow: /app/\nDisallow: /data/\nSitemap: https://jibjip.com/sitemap.xml\n");
          writeFileSync(resolve(output, "sitemap.xml"), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://jibjip.com/</loc></url></urlset>\n');
        }
        writeFileSync(resolve(output, "build-profile.json"), JSON.stringify({ profile, appVersion }, null, 2) + "\n");
        if (profile === "personal") rmSync(resolve(output, "og.png"), { force: true });
        const assets = readdirSync(resolve(output, "assets")).filter(name => /\.(js|css)$/.test(name)).sort().map(name => `/assets/${name}`);
        const integrity = Object.fromEntries([...OFFLINE_SHELL_PATHS, ...assets].map(url => {
          const path = url === "/" ? "index.html" : url === "/app/" ? "app/index.html" : url === "/about/" ? "about/index.html" : url.slice(1);
          return [url, `sha256-${createHash("sha256").update(readFileSync(resolve(output, path))).digest("base64")}`];
        }));
        const fingerprint = createHash("sha256").update(JSON.stringify(integrity)).digest("hex").slice(0, 16);
        const worker = resolve(output, "sw.js");
        writeFileSync(worker, stampServiceWorkerCache(readFileSync(worker, "utf8"), fingerprint, assets, integrity));
        verifyBrandAssets(resolve("."), output);
      },
    }],
    build: {
      target: BROWSER_TARGETS, cssTarget: BROWSER_TARGETS,
      outDir: output, emptyOutDir: true, sourcemap: false,
      rolldownOptions: { input: { home: resolve("apps/web/index.html"), app: resolve("apps/web/app/index.html"), about: resolve("apps/web/about/index.html") } },
    },
  };
});
