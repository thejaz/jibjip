import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { readAppVersion } from "./app-version.mjs";
const version = readAppVersion();
for (const path of ["packages/core/package.json", "apps/web/package.json"]) {
  if (JSON.parse(readFileSync(path, "utf8")).version !== version) throw new Error("Workspace versions must match the core release.");
}
copyFileSync("LICENSE", "packages/core/LICENSE");

const declarations = "packages/core/dist/types/index.d.ts";
writeFileSync(declarations, readFileSync(declarations, "utf8").replace('import "./styles.css";\n', ""));
