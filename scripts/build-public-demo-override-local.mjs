import { cp, mkdir, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const output = process.argv[2] ?? "/tmp/portfolio-public-demo-override-local";
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const file of ["index.html", "script.js", "i18n.js", "analytics.js", "style.css", "runtime-config.js"]) await cp(file, join(output, file));
for (const directory of ["components", "project-core", "services", "images", "data"]) await cp(directory, join(output, directory), { recursive: true });
await mkdir(join(output, "demo"), { recursive: true });
execFileSync(process.execPath, ["scripts/build-public-cms-demo.mjs", join(output, "demo", "cms")], { stdio: "inherit" });
console.log(output);
