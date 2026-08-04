import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import test from "node:test";
import { createCmsLiteServer } from "../cms-lite/dev-server.mjs";

const origin = "http://127.0.0.1:5511";
const run = (command, args, env) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { cwd: process.cwd(), env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = ""; let stderr = ""; child.stdout.on("data", (value) => { stdout += value; }); child.stderr.on("data", (value) => { stderr += value; });
  child.on("error", reject); child.on("close", (code) => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`${command} failed: ${stderr}`)));
});

test("fresh CMS Lite server allows required assets and denies private/repository paths", async () => {
  const server = createCmsLiteServer(); await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  try {
    for (const path of ["/", "/login/", "/style.css", "/cms.css", "/login.js", "/session.js", "/password-change.js", "/api.js", "/cms.js", "/editor/state.js", "/editor/media-previews.js", "/storage/php-api.js", "/project-core/project-model.js", "/project-core/project-normalizer.js", "/project-core/project-validator.js", "/components/project-renderer.js", "/index.html", "/data/projects.lite.json", "/images/avatar.webp"]) assert.equal((await fetch(`http://127.0.0.1:${port}${path}`)).status, 200, path);
    for (const path of ["/cms-api/private-dev/auth.json", "/cms-api/private-dev/projects.json", "/cms-api/private-dev/tokens.json", "/cms-api/private-dev/backups/x", "/cms-api/private-dev/quarantine/x", "/backend/.env", "/AGENTS.md", "/tests/cms-lite-security.test.mjs", "/%2e%2e/cms-api/private-dev/auth.json", "/%252e%252e%252fcms-api/private-dev/auth.json", "/cms-api%2fprivate-dev%2fauth.json"]) assert.notEqual((await fetch(`http://127.0.0.1:${port}${path}`)).status, 200, path);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

test("CLI reset preserves private state and revokes tokens without plaintext auth storage", async () => {
  const root = await mkdtemp(join(tmpdir(), "portfolio-cms-reset-")); const privateRoot = join(root, "private"); const publicRoot = join(root, "public"); const passwordA = randomBytes(18).toString("hex"); const passwordB = randomBytes(18).toString("hex");
  try {
    await run("php", ["cms-api/scripts/init-storage.php", "owner"], { PORTFOLIO_PRIVATE_DATA_ROOT: privateRoot, PORTFOLIO_PUBLIC_ROOT: publicRoot, CMS_BOOTSTRAP_PASSWORD: passwordA });
    await writeFile(join(privateRoot, "tokens.json"), JSON.stringify({ tokens: [{ hash: "a".repeat(64), createdAt: "2026-01-01T00:00:00Z", expiresAt: "2030-01-01T00:00:00Z" }] }));
    const beforeProjects = await readFile(join(privateRoot, "projects.json"), "utf8"); const beforeBackups = await readdir(join(privateRoot, "backups")); const beforeQuarantine = await readdir(join(privateRoot, "quarantine")); const beforeHash = JSON.parse(await readFile(join(privateRoot, "auth.json"), "utf8")).passwordHash;
    await run("php", ["cms-api/scripts/reset-password.php", "owner"], { PORTFOLIO_PRIVATE_DATA_ROOT: privateRoot, PORTFOLIO_PUBLIC_ROOT: publicRoot, CMS_RESET_PASSWORD: passwordB });
    const after = JSON.parse(await readFile(join(privateRoot, "auth.json"), "utf8")); const tokens = JSON.parse(await readFile(join(privateRoot, "tokens.json"), "utf8"));
    const verification = await run("php", ["-r", "echo (password_verify(getenv('OLD_PASSWORD'), getenv('HASH')) ? 'old' : '') . (password_verify(getenv('NEW_PASSWORD'), getenv('HASH')) ? 'new' : '');"], { OLD_PASSWORD: passwordA, NEW_PASSWORD: passwordB, HASH: after.passwordHash });
    assert.notEqual(after.passwordHash, beforeHash); assert.equal(after.passwordHash.includes(passwordB), false); assert.equal(verification.stdout, "new"); assert.equal(await readFile(join(privateRoot, "projects.json"), "utf8"), beforeProjects); assert.deepEqual(await readdir(join(privateRoot, "backups")), beforeBackups); assert.deepEqual(await readdir(join(privateRoot, "quarantine")), beforeQuarantine); assert.deepEqual(tokens.tokens, []);
  } finally { await rm(root, { recursive: true, force: true }); }
});
