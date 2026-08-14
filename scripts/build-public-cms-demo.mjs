import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";

const output = process.argv[2] ?? "/tmp/portfolio-public-cms-demo-build";
await rm(output, { recursive: true, force: true }); await mkdir(output, { recursive: true });
const copy = (source, target = source) => cp(source, join(output, target), { recursive: true });
for (const path of ["components", "project-core", "demo/cms/sandbox", "demo/cms/fixture"]) await copy(path, path === "demo/cms/sandbox" ? "sandbox" : path === "demo/cms/fixture" ? "fixture" : path);
const fixture = JSON.parse(await readFile("demo/cms/fixture/projects.fixture.json", "utf8"));
for (const media of fixture.projects.flatMap((project) => [...project.gallery.desktop, ...project.gallery.mobile])) { const target = media.src.replace(/^\//, ""); await mkdir(join(output, dirname(target)), { recursive: true }); await cp(target, join(output, target)); }
await copy("cms-lite/editor", "cms-lite/editor"); await copy("cms-lite/cms.css", "cms-lite/cms.css"); await copy("style.css"); await copy("demo/cms/demo.css", "demo.css");
let html = await readFile("demo/cms/index.html", "utf8"); html = html.replace("../../style.css", "./style.css").replace("../../cms-lite/cms.css", "./cms-lite/cms.css").replace("./demo.css", "./demo.css"); await writeFile(join(output, "index.html"), html);
let entry = await readFile("demo/cms/demo-entry.js", "utf8"); entry = entry.replace("../../cms-lite/editor/app.js", "./cms-lite/editor/app.js").replace("../../project-core/project-normalizer.js", "./project-core/project-normalizer.js"); await writeFile(join(output, "demo-entry.js"), entry);
const files = []; const walk = async (directory, relative = "") => { for (const item of await (await import("node:fs/promises")).readdir(directory, { withFileTypes: true })) { const path = join(directory, item.name); const name = join(relative, item.name); if (item.isDirectory()) await walk(path, name); else files.push({ path: name, bytes: (await stat(path)).size }); } }; await walk(output);
const forbidden = ["cms-api", "https://www.maxpar.ru/cms-api", "Authorization", "portfolio-cms-lite-token"];
for (const file of files.filter((item) => /\.(?:html|js|json|css)$/.test(item.path))) { const text = await readFile(join(output, file.path), "utf8"); if (forbidden.some((item) => text.includes(item))) throw new Error(`Forbidden demo artifact content: ${file.path}`); }
await writeFile(join(output, "BUILD.json"), `${JSON.stringify({ target: "/demo/cms/", sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), fileCount: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0) }, null, 2)}\n`);
console.log(output);
