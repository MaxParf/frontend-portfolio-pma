import assert from "node:assert/strict";
import test from "node:test";
import { assertPublishableProjectLinks } from "../src/modules/admin-projects/project-links.js";

function link(url: string, index = 0, label = { ru: "Открыть", en: "Open" }) { return { id: `10000000-0000-4000-8000-00000000000${index + 1}`, url, sortOrder: (index + 1) * 10, label }; }
function invalid(url: string) { assert.throws(() => assertPublishableProjectLinks([link(url)]), new RegExp("Invalid links\\.0\\.url publication content\\.")); }

test("publishable project links accept HTTPS and every approved root anchor", () => {
  assert.doesNotThrow(() => assertPublishableProjectLinks([link("https://example.com/path?x=1#section")]));
  for (const anchor of ["#hero", "#featured-projects", "#skills", "#services", "#about", "#contact"]) assert.doesNotThrow(() => assertPublishableProjectLinks([link(anchor)]));
});

test("publishable project links reject all non-contract URL forms at the stable field path", () => {
  for (const value of ["http://example.com", "//example.com", "www.example.com", "/example", "./example", "contact", "#", "#unknown", "#CONTACT", "#contact/", "#contact?x=1", "#contact#other", "%23contact", "mailto:test@example.com", "tel:+123", "ftp://example.com", "javascript:alert(1)", "data:text/html,unsafe", "file:///tmp/a", "https://["]) invalid(value);
});

test("publishable project links detect canonical duplicates within, not across, URL classes", () => {
  assert.throws(() => assertPublishableProjectLinks([link("#contact"), link("#contact", 1)]), new RegExp("Duplicate links\\.1\\.url publication content\\."));
  assert.throws(() => assertPublishableProjectLinks([link("https://example.com"), link("https://example.com/", 1)]), new RegExp("Duplicate links\\.1\\.url publication content\\."));
  assert.doesNotThrow(() => assertPublishableProjectLinks([link("#contact"), link("https://example.com/#contact", 1)]));
});

test("publishable project links retain localized label requirements", () => {
  assert.throws(() => assertPublishableProjectLinks([link("#contact", 0, { ru: "", en: "Open" })]), new RegExp("Missing required links\\.0\\.label\\.ru publication content\\."));
});
