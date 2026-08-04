import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validatePasswordChange } from "../cms-lite/password-change.js";

const cmsSource = readFileSync(new URL("../cms-lite/cms.js", import.meta.url), "utf8");

test("password-change action renders a modal with the three required password controls", () => {
  assert.match(cmsSource, /<button data-change-password class="cms-account-action" type="button">Сменить пароль<\/button>/);
  assert.match(cmsSource, /<dialog class="cms-password-dialog" data-password-dialog/);
  for (const field of ["currentPassword", "newPassword", "confirmPassword"]) assert.match(cmsSource, new RegExp(`name="${field}" type="password"`));
  assert.match(cmsSource, /dialog\?\.showModal\(\)/);
});

test("password-change validation blocks missing, matching old/new, and mismatched confirmation", () => {
  assert.equal(validatePasswordChange({ currentPassword: "", newPassword: "new", confirmPassword: "new" }).valid, false);
  assert.equal(validatePasswordChange({ currentPassword: "same", newPassword: "same", confirmPassword: "same" }).valid, false);
  assert.equal(validatePasswordChange({ currentPassword: "old", newPassword: "new", confirmPassword: "different" }).valid, false);
  assert.equal(validatePasswordChange({ currentPassword: "old", newPassword: "new", confirmPassword: "new" }).valid, true);
});

test("password-change UI prevents navigation, clears sensitive fields, and does not log them", () => {
  assert.match(cmsSource, /event\.target\.matches\("\[data-password-change-form\]"\)/);
  assert.match(cmsSource, /event\.preventDefault\(\)/);
  assert.match(cmsSource, /<form data-password-change-form method="post">/);
  assert.match(cmsSource, /form\.reset\(\)/);
  assert.match(cmsSource, /event\.target\.querySelector\("form"\)\?\.reset\(\)/);
  assert.doesNotMatch(cmsSource, /console\.(log|debug|warn|error)/);
});

test("password adapter is isolated from the dialog and sends only current/new values", () => {
  const apiSource = readFileSync(new URL("../cms-lite/api.js", import.meta.url), "utf8");
  assert.match(cmsSource, /changePassword\(token, \{ currentPassword: credentials\.currentPassword, newPassword: credentials\.newPassword \}\)/);
  assert.match(apiSource, /change-password\.php/);
  assert.doesNotMatch(apiSource, /confirmPassword/);
});
