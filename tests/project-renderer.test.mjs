import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderProjects } from "../components/project-renderer.js";

class FakeNode {
  constructor(tagName = "#fragment") {
    this.tagName = tagName;
    this.children = [];
    this.attributes = new Map();
    this.dataset = {};
    this.className = "";
    this.textContent = "";
    this.isFragment = tagName === "#fragment";
  }

  append(...children) {
    children.forEach((child) => {
      if (child.isFragment) this.children.push(...child.children);
      else this.children.push(child);
    });
  }

  replaceChildren(...children) {
    this.children = [];
    this.append(...children);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }
}

const fixture = JSON.parse(readFileSync(new URL("../data/projects.lite.json", import.meta.url), "utf8"));
const originalDocument = globalThis.document;
globalThis.document = {
  createElement: (tagName) => new FakeNode(tagName),
  createDocumentFragment: () => new FakeNode(),
};

function descendants(node, predicate, result = []) {
  node.children.forEach((child) => {
    if (predicate(child)) result.push(child);
    descendants(child, predicate, result);
  });
  return result;
}

test.after(() => {
  globalThis.document = originalDocument;
});

test("canonical projects render in fixture order for EN and RU", () => {
  const root = new FakeNode("div");
  const rendered = renderProjects({ root, projects: fixture.projects, locale: "en" });
  assert.equal(rendered.length, 3);
  assert.deepEqual(rendered.map((project) => project.id), fixture.projects.map((project) => project.id));
  assert.deepEqual(descendants(root, (node) => node.className === "project-card__title").map((node) => node.textContent), fixture.projects.map((project) => project.title.en));

  renderProjects({ root, projects: fixture.projects, locale: "ru" });
  assert.deepEqual(descendants(root, (node) => node.className === "project-card__title").map((node) => node.textContent), fixture.projects.map((project) => project.title.ru));
});

test("renderer preserves links, gallery grouping, contain styling, and aria labels", () => {
  const root = new FakeNode("div");
  renderProjects({ root, projects: fixture.projects, locale: "en" });
  const links = descendants(root, (node) => node.tagName === "a");
  assert.equal(links.find((node) => node.textContent === "Demo available on request").href, "#contact");
  assert.equal(links.find((node) => node.textContent === "Live platform").target, "_blank");
  const galleries = descendants(root, (node) => node.className.includes("project-card__gallery--"));
  assert.ok(galleries.some((node) => node.className.includes("--desktop")));
  assert.ok(galleries.some((node) => node.className.includes("--mobile")));
  const containImages = descendants(root, (node) => node.className === "project-card__image project-card__image--contain");
  assert.equal(containImages.length, 6);
  const galleryButtons = descendants(root, (node) => node.className === "project-card__gallery-button");
  assert.equal(galleryButtons.find((node) => node.dataset.gallery === "project-bradbury").attributes.get("aria-label"), "Open screenshot: Project Bradbury mobile home feed");
});
