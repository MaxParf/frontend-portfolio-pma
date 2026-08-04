import assert from "node:assert/strict";
import { createServer } from "node:net";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import test from "node:test";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL2zwAAAABJRU5ErkJggg==", "base64");
const run = (command, args, env) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { cwd: process.cwd(), env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  let stderr = ""; child.stderr.on("data", (value) => { stderr += value; });
  child.on("error", reject); child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`${command} failed: ${stderr}`)));
});
const unusedPort = () => new Promise((resolve, reject) => {
  const server = createServer(); server.once("error", reject); server.listen(0, "127.0.0.1", () => { const { port } = server.address(); server.close((error) => error ? reject(error) : resolve(port)); });
});
const waitFor = async (url) => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { await fetch(url, { headers: { Origin: "http://127.0.0.1:5511" } }); return; } catch { await new Promise((resolve) => setTimeout(resolve, 25)); }
  }
  throw new Error("PHP test server did not start");
};

test("isolated PHP media saves persist root-relative images and retain application errors", async () => {
  const root = await mkdtemp(join(tmpdir(), "portfolio-cms-media-")); const privateRoot = join(root, "private"); const publicRoot = join(root, "public"); const port = await unusedPort();
  const env = { PORTFOLIO_PRIVATE_DATA_ROOT: privateRoot, PORTFOLIO_PUBLIC_ROOT: publicRoot, CMS_BOOTSTRAP_PASSWORD: randomBytes(18).toString("hex"), CMS_ALLOWED_ORIGIN: "http://127.0.0.1:5511" };
  const php = spawn("php", ["-S", `127.0.0.1:${port}`, "-t", "cms-api/public"], { cwd: process.cwd(), env: { ...process.env, ...env }, stdio: "ignore" });
  const baseUrl = `http://127.0.0.1:${port}/cms-api`;
  const request = (path, options = {}) => fetch(`${baseUrl}/${path}`, { ...options, headers: { Origin: "http://127.0.0.1:5511", ...(options.headers ?? {}) } });
  try {
    await run("php", ["cms-api/scripts/init-storage.php", "owner"], env); await waitFor(`${baseUrl}/load.php`);
    const login = await request("login.php", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ login: "owner", password: env.CMS_BOOTSTRAP_PASSWORD }) });
    assert.equal(login.status, 200); const { token } = await login.json(); const authenticated = { Authorization: `Bearer ${token}` };
    const load = async () => { const response = await request("load.php", { headers: authenticated }); assert.equal(response.status, 200); return response.json(); };
    const save = async (state, pending, files = {}) => {
      const form = new FormData(); form.set("state", JSON.stringify({ baseVersion: state.version, projects: state.projects })); form.set("pendingMedia", JSON.stringify(pending));
      for (const [id, file] of Object.entries(files)) form.append(`uploads[${id}]`, file, `${id}.png`);
      const response = await request("save.php", { method: "POST", headers: authenticated, body: form }); return { status: response.status, body: await response.json() };
    };
    const media = (state, kind, id, labels = { ru: "Тест", en: "Test" }) => ({ id, projectId: state.projects[0].id, galleryKind: kind, alt: labels, ariaLabel: labels, presentation: kind === "mobile" ? "contain" : "cover" });

    let state = await load();
    const rejected = await save(state, [media(state, "desktop", "desktop-empty", { ru: "", en: "" })], { "desktop-empty": new Blob([png], { type: "image/png" }) });
    assert.deepEqual(rejected, { status: 422, body: { code: "VALIDATION_ERROR" } });

    state = await load(); const textOnly = await save(state, []); assert.equal(textOnly.status, 200);
    state = await load(); const desktop = await save(state, [media(state, "desktop", "desktop-upload")], { "desktop-upload": new Blob([png], { type: "image/png" }) }); assert.equal(desktop.status, 200);
    state = await load(); const mobile = await save(state, [media(state, "mobile", "mobile-upload")], { "mobile-upload": new Blob([png], { type: "image/png" }) }); assert.equal(mobile.status, 200);
    state = await load(); const both = await save(state, [media(state, "desktop", "desktop-both"), media(state, "mobile", "mobile-both")], { "desktop-both": new Blob([png], { type: "image/png" }), "mobile-both": new Blob([png], { type: "image/png" }) }); assert.equal(both.status, 200);
    state = await load(); const replacementId = state.projects[0].gallery.desktop[0].id; const replacement = await save(state, [media(state, "desktop", replacementId)], { [replacementId]: new Blob([png], { type: "image/png" }) }); assert.equal(replacement.status, 200);
    const reloaded = await load(); const project = reloaded.projects[0]; const mediaPaths = ["desktop-upload", "mobile-upload", "desktop-both", "mobile-both", replacementId].map((id) => [...project.gallery.desktop, ...project.gallery.mobile].find((item) => item.id === id).src);
    mediaPaths.forEach((src) => { assert.match(src, /^\/images\/projects\/[a-z0-9-]+\/[a-f0-9]{32}\.png$/); assert.equal(src.startsWith("blob:"), false); });
    const projection = JSON.parse(await readFile(join(publicRoot, "data/projects.lite.json"), "utf8")); assert.equal(projection.projects.some((item) => item.id === project.id && item.gallery.desktop.some((item) => item.id === "desktop-upload")), true);
    state = await load(); const draft = structuredClone(state.projects[0]); draft.id = "isolated-media-draft"; draft.status = "draft"; draft.order = Math.max(...state.projects.map((item) => item.order)) + 10; state.projects.push(draft); assert.equal((await save(state, [])).status, 200);
    state = await load(); const draftResult = await save(state, [{ ...media(state, "desktop", "draft-upload"), projectId: draft.id }], { "draft-upload": new Blob([png], { type: "image/png" }) }); assert.equal(draftResult.status, 200);
    const draftProjection = JSON.parse(await readFile(join(publicRoot, "data/projects.lite.json"), "utf8")); assert.equal(draftProjection.projects.some((item) => item.id === draft.id), false);
    state = await load(); const invalid = await save(state, [media(state, "desktop", "invalid-upload")], { "invalid-upload": new Blob([Buffer.from("not-an-image")], { type: "image/png" }) }); assert.deepEqual(invalid, { status: 415, body: { code: "INVALID_IMAGE_TYPE" } });
  } finally { php.kill(); await rm(root, { recursive: true, force: true }); }
});
