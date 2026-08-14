import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveCmsLiteRoute } from "../cms-lite/dev-server.mjs";
import { CMS_SESSION_KEY, canLeaveCms, clearCmsSession } from "../cms-lite/session.js";

const cmsSource = `${readFileSync(new URL("../cms-lite/cms.js", import.meta.url), "utf8")}\n${readFileSync(new URL("../cms-lite/editor/app.js", import.meta.url), "utf8")}`;
const loginSource = readFileSync(new URL("../cms-lite/login.js", import.meta.url), "utf8");
const loginHtml = readFileSync(new URL("../cms-lite/login/index.html", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../cms-lite/cms.css", import.meta.url), "utf8");
const devServerSource = readFileSync(new URL("../cms-lite/dev-server.mjs", import.meta.url), "utf8");

test("login keeps associated labels and only approved visible form content", () => {
  assert.match(loginHtml, /<label>Login<input name="login" autocomplete="username" required><\/label>/);
  assert.match(loginHtml, /<label>Password<input name="password" type="password" autocomplete="current-password" required><\/label>/);
  assert.match(loginHtml, /<h1 id="cms-login-title">Portfolio CMS<\/h1>/);
  assert.match(loginHtml, /<button class="button button--primary" type="submit">Login<\/button>/);
  assert.match(loginHtml, /<form data-login-form method="post">/);
  assert.doesNotMatch(loginHtml, /Bearer|token|service|debug|security|memory|PHP/i);
  assert.match(loginSource, /form\?\.addEventListener\("submit"/);
  assert.match(loginSource, /event\.preventDefault\(\)/);
});

test("login session import resolves to the CMS Lite module under the dev-server routes", () => {
  assert.match(loginSource, /import \{ CMS_SESSION_KEY \} from "\.\/session\.js"/);
  assert.equal(new URL("./session.js", "http://127.0.0.1:5515/login.js").pathname, "/session.js");
  assert.match(devServerSource, /"\/session\.js"/);
  assert.match(cmsSource, /from "\.\/session\.js"/);
});

test("post-login bootstrap keeps every CMS dependency routable and exposes load failures", () => {
  for (const modulePath of ["/cms.js", "/session.js", "/password-change.js", "/api.js", "/editor/state.js", "/editor/media-previews.js", "/storage/php-api.js", "/project-core/project-model.js", "/project-core/project-normalizer.js", "/project-core/project-validator.js", "/components/project-renderer.js"]) assert.notEqual(resolveCmsLiteRoute(modulePath), null, modulePath);
  assert.match(cmsSource, /snapshot = await editor\.load\(\);/);
  assert.match(cmsSource, /mountCmsEditor/);
  assert.match(cmsSource, /app\.load\(\)\.catch/);
});

test("shared CMS editor exposes a visible save failure", () => {
  assert.match(cmsSource, /errorMessage = error\?\.message \|\| "Хранилище временно недоступно\."/);
  assert.match(cmsSource, /connectionStatus = "DISCONNECTED"/);
});

test("project status selector occurs once in the editor heading and remains data-bound", () => {
  assert.equal((cmsSource.match(/data-status/g) ?? []).length, 2);
  assert.match(cmsSource, /cms-editor-heading[\s\S]*data-status/);
  const primaryFieldset = cmsSource.slice(cmsSource.indexOf('<fieldset class="cms-fieldset"><legend>Основное</legend>'), cmsSource.indexOf('<fieldset class="cms-fieldset"><legend>Описание</legend>'));
  assert.doesNotMatch(primaryFieldset, /data-status/);
  assert.match(cmsSource, /target\.matches\("\[data-status\]"\)\) mutate/);
});

test("login form has a responsive vertical full-width control contract", () => {
  assert.match(cssSource, /\[data-login-form\] \{ display: grid; gap: 16px; margin-top: 24px; \}/);
  assert.match(cssSource, /\[data-login-form\] label \{ display: grid; gap: 7px;/);
  assert.match(cssSource, /\[data-login-form\] input, \[data-login-form\] button \{ box-sizing: border-box; width: 100%; min-height: 42px;/);
  assert.match(cssSource, /\[data-login-form\] input:focus-visible/);
});

test("Logout is a header button that clears the session and routes to login", () => {
  assert.match(cmsSource, /<button data-logout class="cms-logout" type="button">Выйти<\/button>/);
  assert.match(cmsSource, /clearCmsSession\(sessionStorage\)/);
  assert.match(cmsSource, /location\.assign\("\/login\/"\)/);
  assert.match(cmsSource, /previewStore\.dispose\(\)/);
  const removed = [];
  clearCmsSession({ removeItem: (key) => removed.push(key) });
  assert.deepEqual(removed, [CMS_SESSION_KEY]);
});

test("dirty Logout requires confirmation while clean Logout does not", () => {
  let confirmationCalls = 0;
  assert.equal(canLeaveCms({ dirty: true, confirmLeave: () => { confirmationCalls += 1; return false; } }), false);
  assert.equal(confirmationCalls, 1);
  assert.equal(canLeaveCms({ dirty: true, confirmLeave: () => { confirmationCalls += 1; return true; } }), true);
  assert.equal(confirmationCalls, 2);
  assert.equal(canLeaveCms({ dirty: false, confirmLeave: () => { confirmationCalls += 1; return false; } }), true);
  assert.equal(confirmationCalls, 2);
  assert.match(cmsSource, /canLeaveCms\(\{ dirty: snapshot\.dirty, confirmLeave: \(message\) => window\.confirm\(message\) \}\)/);
});
