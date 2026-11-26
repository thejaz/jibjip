import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmdirSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import ts from "typescript";
import { readAppVersion } from "./app-version.mjs";
import { BROWSER_TARGETS } from "./browser-targets.mjs";

/** Consume only the actual packed files; no workspace source aliases or defines. */
export async function verifyCorePackage() {
  if (!process.env.npm_execpath) throw new Error("Run package verification through npm so its existing CLI is used.");
  const candidate = resolve("work/package-candidate");
  const consumer = resolve("work/package-qa");
  mkdirSync(candidate, { recursive: true });
  mkdirSync(consumer, { recursive: true });
  const result = JSON.parse(execFileSync(process.execPath, [process.env.npm_execpath, "pack", "./packages/core", "--ignore-scripts", "--json", "--pack-destination", candidate], { encoding: "utf8" }))[0];
  const archive = resolve(candidate, result.filename);
  // Validate every member before extracting; public packages never contain links.
  execFileSync("python", ["-B", "-c", `import sys,tarfile,pathlib
root=pathlib.Path(sys.argv[2]).resolve()
with tarfile.open(sys.argv[1]) as archive:
 for item in archive:
  path=root.joinpath(item.name).resolve()
  if not path.is_relative_to(root) or item.issym() or item.islnk() or not item.name.startswith('package/'):
   raise ValueError('Unsafe package entry')
 archive.extractall(root,filter='data')`, archive, consumer], { stdio: "pipe" });
  const packed = resolve(consumer, "package");
  const manifest = JSON.parse(readFileSync(resolve(packed, "package.json"), "utf8"));
  if (manifest.version !== readAppVersion() || manifest.private !== true) throw new Error("Unexpected package release metadata.");
  if (readFileSync(resolve(packed, "LICENSE"), "utf8") !== readFileSync("LICENSE", "utf8")) throw new Error("Package license mismatch.");
  for (const name of result.files.map(file => file.path)) {
    if (!/^(package\.json|README\.md|LICENSE|dist\/|assets\/)/.test(name) || /(?:\.map$|\.local\.|node_modules|collaboration)/.test(name)) throw new Error("Unexpected package contents.");
  }
  for (const target of ["dist/index.js", "dist/style.css", "dist/types/index.d.ts", "assets/data/jibjip-starter-seed.json", "assets/audio/chick.mp3"]) {
    if (!existsSync(resolve(packed, target))) throw new Error("Packed public interface is incomplete.");
  }
  mkdirSync(resolve(consumer, "app"), { recursive: true });
  const html = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>JIBJIP package consumer</title><div id="root"></div><script type="module" src="/entry.ts"></script></html>';
  writeFileSync(resolve(consumer, "index.html"), html);
  writeFileSync(resolve(consumer, "app/index.html"), html);
  writeFileSync(resolve(consumer, "entry.ts"), `import { mountJibjip } from "@jibjip/core";\nimport "@jibjip/core/style.css";\nvoid mountJibjip({container: document.getElementById("root")!, view: location.pathname.startsWith("/app") ? "application" : "introduction", profile: "development"});\n`);
  // Resolve the packed package through its real exports. This temporary link
  // contains no installed/copied dependencies; peers use the existing toolchain.
  const consumerModules = resolve(consumer, "node_modules");
  const scope = resolve(consumerModules, "@jibjip");
  const packageLink = resolve(scope, "core");
  if (existsSync(consumerModules)) throw new Error("Consumer dependencies must not exist before verification.");
  mkdirSync(scope, { recursive: true });
  let linked = false;
  try {
    symlinkSync(packed, packageLink, "junction");
    linked = true;
    const program = ts.createProgram([resolve(consumer, "entry.ts")], {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler, strict: true,
      noEmit: true, skipLibCheck: true, types: [],
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    if (diagnostics.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCurrentDirectory: () => consumer, getNewLine: () => "\n", getCanonicalFileName: value => value,
    }));
    await build({
      configFile: false, root: consumer, publicDir: resolve(packed, "assets"),
      resolve: { preserveSymlinks: true, dedupe: ["react", "react-dom"] },
      build: { target: BROWSER_TARGETS, cssTarget: BROWSER_TARGETS, outDir: resolve(consumer, "site"), emptyOutDir: true, rolldownOptions: { input: { home: resolve(consumer, "index.html"), app: resolve(consumer, "app/index.html") } } },
      logLevel: "warn",
    });
  } finally {
    if (linked) unlinkSync(packageLink);
    rmdirSync(scope);
    rmdirSync(consumerModules);
  }
  cpSync(resolve(packed, "LICENSE"), resolve(consumer, "site/LICENSE.txt"));
  const report = { version: manifest.version, files: result.files.length, bytes: result.size, integrity: result.integrity, isolatedConsumerBuild: true, consumerTypes: true };
  writeFileSync(resolve(candidate, "verification.json"), JSON.stringify(report, null, 2) + "\n");
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await verifyCorePackage()));
