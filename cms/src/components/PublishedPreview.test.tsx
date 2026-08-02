import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { PublishedPreview } from "./PublishedPreview";
import type { DraftContent } from "../api/types";

const content: DraftContent = {
  slug: "preview", galleryId: "preview", sortOrder: 10, projectType: null, dates: { startedAt: null, endedAt: null, ongoing: false }, technologies: [{ slug: "react", name: "React", sortOrder: 10 }],
  translations: { ru: { title: "Заголовок", subtitle: null, description: "Описание", role: "Роль", statusLabel: "Статус", technologiesTitle: null, displayType: "Тип" }, en: { title: "Title", subtitle: null, description: "Description", role: "Role", statusLabel: "Status", technologiesTitle: null, displayType: "Type" } },
  features: [{ id: "11111111-1111-4111-8111-111111111111", sortOrder: 10, text: { ru: "Функция", en: "Feature" } }], notes: [{ id: "22222222-2222-4222-8222-222222222222", sortOrder: 10, text: { ru: "Примечание", en: "Note" } }],
  links: [{ id: "secondary", url: "https://example.test/secondary", sortOrder: 20, label: { ru: "Вторая ссылка", en: "Second link" } }, { id: "primary", url: "https://example.test/primary", sortOrder: 10, label: { ru: "Основная ссылка", en: "Primary link" } }],
  media: [
    { id: "mobile", sourceType: "legacy", src: "mobile.png", role: "gallery", orientation: "vertical", galleryKind: "mobile", presentation: "cover", sortOrder: 10, translations: { ru: { alt: "mobile", ariaLabel: "mobile" }, en: { alt: "mobile", ariaLabel: "mobile" } } },
    { id: "desktop", sourceType: "legacy", src: "desktop.png", role: "gallery", orientation: "horizontal", galleryKind: "desktop", presentation: "cover", sortOrder: 10, translations: { ru: { alt: "desktop", ariaLabel: "desktop" }, en: { alt: "desktop", ariaLabel: "desktop" } } },
  ],
};

it("renders notes, links, mobile gallery, then desktop gallery", () => {
  const { container } = render(<PublishedPreview content={content} locale="ru" />);
  expect(screen.getByRole("link", { name: "Основная ссылка" }).getAttribute("href")).toBe("https://example.test/primary");
  const html = container.querySelector(".preview-card")!.innerHTML;
  expect(html.indexOf("Примечание")).toBeLessThan(html.indexOf("Основная ссылка"));
  expect(html.indexOf("Основная ссылка")).toBeLessThan(html.indexOf("Мобильные изображения"));
  expect(html.indexOf("Мобильные изображения")).toBeLessThan(html.indexOf("Десктопные изображения"));
});

it("uses the selected locale, sort order, and safely hides partial links", () => {
  const partial: DraftContent = { ...content, links: [...content.links, { id: "hidden", url: "", sortOrder: 30, label: { ru: "Скрыта", en: "Hidden" } }, { id: "also-hidden", url: "https://example.test/hidden", sortOrder: 40, label: { ru: "", en: "" } }] };
  const originalOrder = partial.links.map((link) => link.id);
  render(<PublishedPreview content={partial} locale="en" />);
  expect(screen.getByRole("link", { name: "Primary link" }).getAttribute("href")).toBe("https://example.test/primary");
  expect(screen.getByRole("link", { name: "Second link" })).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Hidden" })).toBeNull();
  expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual(["Primary link", "Second link"]);
  expect(partial.links.map((link) => link.id)).toEqual(originalOrder);
});
