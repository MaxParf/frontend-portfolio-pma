import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const project = new URL("..", import.meta.url).pathname;
const app = "/tmp/portfolio-cms-desktop-build/Portfolio CMS.app";
const contents = join(app, "Contents");
const runtime = join(contents, "Resources/runtime");

test("identity and foreign-listener logic are present", () => {
  const launcher = join(contents, "MacOS/PortfolioCMSLauncher");
  assert.equal(execFileSync(launcher, ["--self-test"], { encoding: "utf8" }).trim(), "PortfolioCMSLauncher self-test passed");
  const source = readFileSync(join(project, "Sources/PortfolioCMSLauncher/main.swift"), "utf8");
  assert.match(source, /titleMarker/); assert.match(source, /case \.foreign/); assert.match(source, /addingTimeInterval\(15\)/);
});
test("bundle contains executable pinned Node and required plist", () => {
  const launcher = join(contents, "MacOS/PortfolioCMSLauncher"); assert.equal(existsSync(launcher), true); assert.ok(statSync(launcher).mode & 0o111);
  assert.match(execFileSync(join(contents, "Resources/node/node"), ["--version"], { encoding: "utf8" }), /^v24\.19\.0\s*$/);
  const plistPath = join(contents, "Info.plist");
  const plistValue = (key) => execFileSync("/usr/libexec/PlistBuddy", ["-c", `Print :${key}`, plistPath], { encoding: "utf8" }).trim();
  assert.equal(plistValue("CFBundleIdentifier"), "ru.maxpar.portfolio-cms");
  assert.equal(plistValue("CFBundleName"), "Portfolio CMS");
  assert.equal(plistValue("CFBundleDisplayName"), "Portfolio CMS");
  assert.equal(plistValue("CFBundleShortVersionString"), "1.0.0");
  assert.equal(plistValue("CFBundleVersion"), "1");
  assert.equal(plistValue("LSUIElement"), "true");
  const sourceIcon = join(project, "resources/AppIcon.icns");
  const bundledIcon = join(contents, "Resources/AppIcon.icns");
  assert.equal(existsSync(bundledIcon), existsSync(sourceIcon), "approved source icon is copied exactly when present");
  if (existsSync(sourceIcon)) assert.equal(plistValue("CFBundleIconFile"), "AppIcon");
  execFileSync("codesign", ["--verify", "--deep", "--strict", app]);
});
test("runtime is immutable-commit output with no secrets or forbidden paths", () => {
  assert.match(readFileSync(join(runtime, "VERSION"), "utf8"), /source_commit=cf5832091250c28363eedf56888074798a727146/);
  assert.match(readFileSync(join(runtime, "cms-lite/runtime-config.js"), "utf8"), /https:\/\/www\.maxpar\.ru\/cms-api/);
  assert.match(readFileSync(join(runtime, "cms-lite/dev-server.mjs"), "utf8"), /127\.0\.0\.1/);
  for (const forbidden of ["cms", "cms-api", "backend", "tests", "docs", ".git", "node_modules", "package.json"]) assert.equal(existsSync(join(runtime, forbidden)), false, forbidden);
  const scan = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? scan(join(directory, entry.name)) : [join(directory, entry.name)]);
  const secretPattern = /(CMS_BOOTSTRAP_PASSWORD|CMS_RESET_PASSWORD|PORTFOLIO_PRIVATE_DATA_ROOT|private-dev\/(?:auth|tokens|projects)\.json|BEGIN (?:RSA|OPENSSH) PRIVATE KEY)/;
  for (const file of scan(runtime).filter((file) => /\.(?:js|html|json|txt)$/.test(file))) assert.doesNotMatch(readFileSync(file, "utf8"), secretPattern, file);
});
