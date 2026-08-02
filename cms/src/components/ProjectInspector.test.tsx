import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectInspector } from "./ProjectInspector";
import type { DraftContent, ProjectEditor } from "../api/types";

const ids = {
  verticalOne: "11111111-1111-4111-8111-111111111111",
  verticalTwo: "22222222-2222-4222-8222-222222222222",
  horizontal: "33333333-3333-4333-8333-333333333333",
};

function content(includeMissingDimensions = false): DraftContent {
  const translations = { en: { alt: "Image", ariaLabel: "Open image" }, ru: { alt: "Изображение", ariaLabel: "Открыть изображение" } };
  return {
    slug: "project-bradbury", galleryId: "bradbury", sortOrder: 20, projectType: null, dates: { startedAt: null, endedAt: null, ongoing: true },
    translations: { en: { title: "Project Bradbury", subtitle: null, description: "Description", role: "Founder", statusLabel: "Published", technologiesTitle: null, displayType: "Quiet social platform" }, ru: { title: "Проект Брэдбери", subtitle: null, description: "Описание", role: "Основатель", statusLabel: "Опубликовано", technologiesTitle: null, displayType: "Тихая социальная платформа" } },
    technologies: [], links: [{ id: "99999999-9999-4999-8999-999999999999", url: "https://example.test", sortOrder: 10, label: { ru: "Открыть", en: "Open" } }],
    features: [{ id: "44444444-4444-4444-8444-444444444444", sortOrder: 10, text: { ru: "Функция", en: "Feature" } }], notes: [{ id: "55555555-5555-4555-8555-555555555555", sortOrder: 10, text: { ru: "Примечание", en: "Note" } }],
    media: [
      { id: ids.verticalOne, sourceType: "managed", assetId: ids.verticalOne, role: "gallery", orientation: "vertical", galleryKind: "mobile", presentation: "cover", sortOrder: 10, width: 941, height: 2048, translations },
      { id: ids.verticalTwo, sourceType: "managed", assetId: ids.verticalTwo, role: "gallery", orientation: "vertical", galleryKind: "mobile", presentation: "cover", sortOrder: 20, width: 600, height: 600, translations },
      { id: ids.horizontal, sourceType: "managed", assetId: ids.horizontal, role: "gallery", orientation: "horizontal", galleryKind: "desktop", presentation: "cover", sortOrder: 10, ...(includeMissingDimensions ? {} : { width: 2048, height: 941 }), translations },
    ],
  };
}

function editor(includeMissingDimensions = false): ProjectEditor {
  const draft = content(includeMissingDimensions);
  return { project: { id: "project-id", externalKey: "project:bradbury", slug: draft.slug, status: "published" }, published: { revisionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", revisionNumber: 1, revisionType: "published", baseRevisionId: null, content: draft, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", publishedAt: "2026-01-01T00:00:00.000Z" }, draft: null, editable: { source: "published", revisionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", content: draft }, meta: { hasUnpublishedChanges: false }, localePublicationCapability: "legacy", publicationState: { ru: { status: "published", publishedRevisionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", publishedAt: "2026-01-01T00:00:00.000Z", publicationGeneration: 0, hasUnpublishedChanges: false, isPublishable: true }, en: { status: "published", publishedRevisionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", publishedAt: "2026-01-01T00:00:00.000Z", publicationGeneration: 0, hasUnpublishedChanges: false, isPublishable: true } } };
}
function localeEditor(): ProjectEditor { const value = editor(); return { ...value, localePublicationCapability: "locale", publicationState: { ...value.publicationState, ru: { ...value.publicationState.ru, status: "not_published", publishedRevisionId: null, publishedAt: null, publicationGeneration: 3 }, en: { ...value.publicationState.en, status: "not_published", publishedRevisionId: null, publishedAt: null, publicationGeneration: 7 } } }; }
function technologyEditor(): ProjectEditor { const value = editor(); value.editable.content.technologies = [{ slug: "react", name: "React", sortOrder: 10 }, { slug: "typescript", name: "TypeScript", sortOrder: 20 }]; return value; }
function draftEditor(): ProjectEditor { const value = editor(); const draftContent = structuredClone(value.editable.content); value.draft = { ...value.published!, revisionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", revisionNumber: 2, revisionType: "draft", baseRevisionId: value.published!.revisionId, content: draftContent, publishedAt: null }; value.editable = { source: "draft", revisionId: value.draft.revisionId, content: draftContent }; return value; }
function unpublishedEditor(): ProjectEditor { const value = draftEditor(); value.project = { ...value.project, id: "unpublished-id", slug: "new-project-unpublished", status: "draft" }; value.draft!.content.slug = value.project.slug; value.editable.content.slug = value.project.slug; value.published = null; value.draft = { ...value.draft!, baseRevisionId: null }; value.publicationState = { ru: { status: "not_published", publishedRevisionId: null, publishedAt: null, publicationGeneration: 0, hasUnpublishedChanges: true, isPublishable: false }, en: { status: "not_published", publishedRevisionId: null, publishedAt: null, publicationGeneration: 0, hasUnpublishedChanges: true, isPublishable: false } }; return value; }

function renderInspector(includeMissingDimensions = false) {
  return render(<ProjectInspector editor={editor(includeMissingDimensions)} locale="en" loading={false} onSaved={vi.fn().mockResolvedValue(null)} onPreview={vi.fn()} onDirtyChange={vi.fn()} />);
}

function renderEditor(value: ProjectEditor) {
  return render(<ProjectInspector editor={value} locale="en" loading={false} onSaved={vi.fn().mockResolvedValue(null)} onPreview={vi.fn()} onDirtyChange={vi.fn()} />);
}

async function openMedia() {
  await screen.findByRole("heading", { name: "Мобильные изображения" });
}

describe("ProjectInspector media corrective QA", () => {
  it("uses a separate irreversible project delete action only for an unpublished editor", async () => {
    const deleted = vi.fn().mockResolvedValue(undefined);
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => new Response(null, { status: 204 })); vi.stubGlobal("fetch", fetch);
    render(<ProjectInspector editor={unpublishedEditor()} locale="en" loading={false} onSaved={vi.fn().mockResolvedValue(null)} onProjectDeleted={deleted} onPreview={vi.fn()} onDirtyChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Удалить проект" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Удалить черновик" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Удалить проект" }));
    expect(await screen.findByRole("dialog", { name: "Удалить неопубликованный проект?" })).toBeTruthy();
    expect(screen.getByText(/Медиафайлы не удаляются из хранилища/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Удалить проект" })[1]!);
    await waitFor(() => expect(deleted).toHaveBeenCalledWith("unpublished-id"));
    expect(fetch.mock.calls[0]?.[1]?.method).toBe("DELETE");
    expect(String(fetch.mock.calls[0]?.[0])).toContain("/api/v1/admin/projects/new-project-unpublished");
  });

  it("sends the legacy draft precondition without changing the save UI", async () => {
    const response = { data: { revisionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", revisionNumber: 2, updatedAt: "2026-01-02T00:00:00.000Z" } };
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify(response), { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);
    render(<ProjectInspector editor={localeEditor()} locale="en" loading={false} onSaved={vi.fn().mockResolvedValue(null)} onPreview={vi.fn()} onDirtyChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Название — русский"), { target: { value: "Обновлено" } }); fireEvent.click(screen.getByRole("button", { name: "Сохранить черновик" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const body = JSON.parse(fetch.mock.calls[0]?.[1]?.body as string);
    expect(body).toMatchObject({ publicationCapability: "legacy", expectedDraftRevisionId: null });
    expect(screen.getByRole("button", { name: "Сохранить черновик" })).toBeTruthy();
  });
  it("renders one sequential editor flow without tabs", () => {
    renderInspector();

    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      "Тип и статус",
      "Название проекта",
      "Роль",
      "Описание",
      "Функции и задачи",
      "Технологии",
      "Примечания",
      "Ссылки",
      "Галерея мобильной версии",
      "Галерея десктопной версии",
      "Публикация",
    ]);
    expect(screen.getByLabelText("Название — русский")).toBeTruthy();
    expect(screen.getByLabelText("Загрузить: мобильные изображения")).toBeTruthy();
    expect(screen.getByLabelText("Загрузить: десктопные изображения")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Сохранить черновик" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Опубликовать" })).toBeTruthy();
    const schedule = screen.getByRole("button", { name: "Запланировать публикацию" });
    expect(schedule.hasAttribute("disabled")).toBe(true);
    expect(schedule.getAttribute("title")).toBe("Планирование станет доступно после реализации серверного расписания публикаций.");
    expect(screen.getByLabelText("Фактическая дата публикации").hasAttribute("readonly")).toBe(true);
    expect(screen.getByText("Дата устанавливается системой при публикации.")).toBeTruthy();
    expect(screen.getByText("Планирование станет доступно после реализации серверного расписания публикаций.")).toBeTruthy();
  });

  it("loads canonical history outside the editor without replacing an unsaved draft", async () => {
    const onPreview = vi.fn();
    const onDirtyChange = vi.fn();
    const historicalContent = { ...content(), translations: { ...content().translations, en: { ...content().translations.en, title: "Historical revision" } } };
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify({ data: [{ revisionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", revisionNumber: 3, revisionType: "published", baseRevisionId: null, content: historicalContent, createdAt: "2026-01-02T00:00:00.000Z", updatedAt: "2026-01-03T00:00:00.000Z", publishedAt: "2026-01-03T00:00:00.000Z" }] }), { headers: { "content-type": "application/json" } }))));
    render(<ProjectInspector editor={editor()} locale="en" loading={false} onSaved={vi.fn().mockResolvedValue(null)} onPreview={onPreview} onDirtyChange={onDirtyChange} />);

    fireEvent.change(screen.getByLabelText("Название — русский"), { target: { value: "Несохранённое название" } });
    fireEvent.click(screen.getByRole("button", { name: "История" }));

    expect(await screen.findByRole("heading", { name: "История" })).toBeTruthy();
    expect(await screen.findByText(/Historical revision/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /restore/i })).toBeNull();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    fireEvent.click(screen.getByRole("button", { name: "Редактор" }));
    expect((screen.getByLabelText("Название — русский") as HTMLInputElement).value).toBe("Несохранённое название");
  });

  it("edits, reorders, removes, and adds normalized links without changing their IDs", () => {
    const onPreview = vi.fn();
    render(<ProjectInspector editor={editor()} locale="en" loading={false} onSaved={vi.fn().mockResolvedValue(null)} onPreview={onPreview} onDirtyChange={vi.fn()} />);
    expect((screen.getByLabelText("Название ссылки — русский") as HTMLInputElement).value).toBe("Открыть");
    fireEvent.change(screen.getByLabelText("Название ссылки — русский"), { target: { value: "Открыть проект" } });
    expect(onPreview).toHaveBeenLastCalledWith(expect.objectContaining({ links: [expect.objectContaining({ id: "99999999-9999-4999-8999-999999999999", label: { ru: "Открыть проект", en: "Open" } })] }));
    fireEvent.click(screen.getByRole("button", { name: "+ Добавить ссылку" }));
    const added = onPreview.mock.calls.at(-1)?.[0].links.at(-1);
    expect(added).toEqual(expect.objectContaining({ id: expect.any(String), url: "", sortOrder: 20, label: { ru: "", en: "" } }));
    fireEvent.click(screen.getByRole("button", { name: "Переместить ссылку 2 выше" }));
    const moved = onPreview.mock.calls.at(-1)?.[0].links;
    expect(moved.map((link: DraftContent["links"][number]) => link.id)).toEqual([added.id, "99999999-9999-4999-8999-999999999999"]);
    expect(moved.map((link: DraftContent["links"][number]) => link.sortOrder)).toEqual([10, 20]);
    fireEvent.click(screen.getByRole("button", { name: "Удалить ссылку 1" }));
    expect(onPreview.mock.calls.at(-1)?.[0].links).toEqual([expect.objectContaining({ id: "99999999-9999-4999-8999-999999999999", sortOrder: 10 })]);
  });

  it("edits paired content blocks independently and creates stable feature items", () => {
    const onPreview = vi.fn();
    render(<ProjectInspector editor={editor()} locale="en" loading={false} onSaved={vi.fn().mockResolvedValue(null)} onPreview={onPreview} onDirtyChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Отображаемый тип — русский"), { target: { value: "Новый тип" } });
    expect(onPreview).toHaveBeenLastCalledWith(expect.objectContaining({ translations: expect.objectContaining({ ru: expect.objectContaining({ displayType: "Новый тип" }), en: expect.objectContaining({ displayType: "Quiet social platform" }) }) }));
    fireEvent.click(screen.getByRole("button", { name: "+ Добавить функцию или задачу" }));
    expect(onPreview).toHaveBeenLastCalledWith(expect.objectContaining({ features: expect.arrayContaining([expect.objectContaining({ id: expect.any(String), text: { ru: "", en: "" } })]) }));
  });

  it("keeps the media reference until removal is confirmed and returns focus after Cancel", async () => {
    renderInspector(); await openMedia();
    const remove = screen.getByRole("button", { name: "Удалить изображение «Мобильные изображения» 1" });
    remove.focus(); fireEvent.click(remove);
    expect(screen.getByRole("dialog", { name: "Удалить изображение?" })).toBeTruthy();
    expect(screen.getByText("Image · 1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Отмена" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Удалить изображение «Мобильные изображения» 1" })).toBeTruthy();
    expect(document.activeElement).toBe(remove);
  });

  it("removes only the confirmed vertical reference, preserves horizontal media, and focuses the next item", async () => {
    renderInspector(); await openMedia();
    fireEvent.click(screen.getByRole("button", { name: "Удалить изображение «Мобильные изображения» 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Удалить изображение" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.queryByRole("button", { name: "Удалить изображение «Мобильные изображения» 2" })).toBeNull();
    const nextRemove = screen.getByRole("button", { name: "Удалить изображение «Мобильные изображения» 1" });
    expect(screen.getByRole("button", { name: "Удалить изображение «Десктопные изображения» 1" })).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(nextRemove));
  });

  it("closes removal confirmation with Escape without changing draft media", async () => {
    renderInspector(); await openMedia();
    fireEvent.click(screen.getByRole("button", { name: "Удалить изображение «Десктопные изображения» 1" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Удалить изображение «Десктопные изображения» 1" })).toBeTruthy();
  });

  it("renders managed dimensions and a localized accessible dimensions label", async () => {
    renderInspector(); await openMedia();
    expect(screen.getByText("941 × 2048 px")).toBeTruthy();
    expect(screen.getByText("Размеры изображения: 941 на 2048 пикселей")).toBeTruthy();
    expect(screen.getByText("2048 × 941 px")).toBeTruthy();
  });

  it("renders the missing dimensions fallback without making it editable", async () => {
    renderInspector(true); await openMedia();
    expect(screen.getByText("Размеры недоступны")).toBeTruthy();
    expect(screen.queryByRole("spinbutton", { name: /width|height/i })).toBeNull();
  });

  it("renders the dimensions fallback for legacy media", async () => {
    const value = editor();
    value.published!.content.media = [{ id: "legacy:vertical", sourceType: "legacy", src: "images/legacy.png", role: "gallery", orientation: "vertical", galleryKind: "mobile", presentation: "cover", sortOrder: 10, translations: { en: { alt: "Legacy image", ariaLabel: "Open legacy image" }, ru: { alt: "Старое изображение", ariaLabel: "Открыть старое изображение" } } }];
    renderEditor(value); await openMedia();
    expect(screen.getByText("Размеры недоступны")).toBeTruthy();
  });

  it("announces a vertical reorder using only the vertical group count", async () => {
    renderInspector(); await openMedia();
    fireEvent.click(screen.getAllByRole("button", { name: "Переместить изображение «Мобильные изображения» вниз" }).find((button) => !button.hasAttribute("disabled"))!);
    expect(screen.getByText("Изображение перемещено на позицию 2 из 2 в группе «Мобильные изображения».")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Удалить изображение «Десктопные изображения» 1" })).toBeTruthy();
  });

  it("keeps both orientation upload controls and only exposes presentation selects for managed media", async () => {
    renderInspector(); await openMedia();
    expect(screen.getByLabelText("Загрузить: мобильные изображения")).toBeTruthy();
    expect(screen.getByLabelText("Загрузить: десктопные изображения")).toBeTruthy();
    expect(screen.getAllByRole("combobox", { name: "Отображение изображения" })).toHaveLength(3);
    expect(screen.queryByRole("combobox", { name: /orientation|role/i })).toBeNull();
  });

  it("lets managed media retain an explicit presentation mode in draft state", async () => {
    const onPreview = vi.fn();
    render(<ProjectInspector editor={editor()} locale="en" loading={false} onSaved={vi.fn().mockResolvedValue(null)} onPreview={onPreview} onDirtyChange={vi.fn()} />);
    await openMedia();
    const display = screen.getAllByLabelText("Отображение изображения")[0];
    fireEvent.change(display, { target: { value: "contain" } });
    expect(onPreview).toHaveBeenLastCalledWith(expect.objectContaining({ media: expect.arrayContaining([expect.objectContaining({ id: ids.verticalOne, presentation: "contain" })]) }));
  });

  it("renders published-without-draft as an editable published baseline", () => {
    const onPreview = vi.fn();
    render(<ProjectInspector editor={editor()} locale="en" loading={false} onSaved={vi.fn().mockResolvedValue(null)} onPreview={onPreview} onDirtyChange={vi.fn()} />);
    expect((screen.getByLabelText("Название — русский") as HTMLInputElement).value).toBe("Проект Брэдбери");
    expect(screen.queryByText("Черновик отсутствует.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Создать черновик из опубликованной версии" })).toBeNull();
    expect(screen.getByRole("button", { name: "Сохранить черновик" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Название — русский"), { target: { value: "Изменённый baseline" } });
    expect(onPreview).toHaveBeenLastCalledWith(expect.objectContaining({ translations: expect.objectContaining({ ru: expect.objectContaining({ title: "Изменённый baseline" }) }) }));
  });

  it("does not reset an edited form when a parent rerender replaces the preview callback", () => {
    const value = editor();
    const view = render(<ProjectInspector editor={value} locale="en" loading={false} onSaved={vi.fn().mockResolvedValue(null)} onPreview={vi.fn()} onDirtyChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Название — русский"), { target: { value: "Сохранить локальный ввод" } });
    view.rerender(<ProjectInspector editor={value} locale="en" loading={false} onSaved={vi.fn().mockResolvedValue(null)} onPreview={vi.fn()} onDirtyChange={vi.fn()} />);
    expect((screen.getByLabelText("Название — русский") as HTMLInputElement).value).toBe("Сохранить локальный ввод");
  });

  it("keeps the technology slug input DOM node, focus, caret, and preview updates through typing and deletion", () => {
    const onPreview = vi.fn();
    render(<ProjectInspector editor={technologyEditor()} locale="en" loading={false} onSaved={vi.fn().mockResolvedValue(null)} onPreview={onPreview} onDirtyChange={vi.fn()} />);
    const originalInput = screen.getAllByLabelText("Slug технологии")[0] as HTMLInputElement;
    originalInput.focus();
    originalInput.setSelectionRange(5, 5);
    for (const value of ["react-1", "react-12", "react-123", "react-1234"]) {
      fireEvent.change(originalInput, { target: { value, selectionStart: value.length, selectionEnd: value.length } });
      expect(screen.getAllByLabelText("Slug технологии")[0]).toBe(originalInput);
      expect(document.activeElement).toBe(originalInput);
    }
    expect(originalInput.value).toBe("react-1234");
    expect(originalInput.selectionStart).toBe(10);
    expect(originalInput.selectionEnd).toBe(10);
    expect(onPreview).toHaveBeenLastCalledWith(expect.objectContaining({ technologies: [expect.objectContaining({ slug: "react-1234", name: "React", sortOrder: 10 }), expect.objectContaining({ slug: "typescript", name: "TypeScript", sortOrder: 20 })] }));

    fireEvent.change(originalInput, { target: { value: "react-123", selectionStart: 9, selectionEnd: 9 } });
    expect(screen.getAllByLabelText("Slug технологии")[0]).toBe(originalInput);
    expect(document.activeElement).toBe(originalInput);
    expect(originalInput.value).toBe("react-123");
    expect(originalInput.selectionStart).toBe(9);
    expect(originalInput.selectionEnd).toBe(9);
    expect(onPreview).toHaveBeenLastCalledWith(expect.objectContaining({ technologies: expect.arrayContaining([expect.objectContaining({ slug: "react-123" })]) }));
  });

  it("keeps controlled technology name and slug values aligned after the existing reorder action", () => {
    const onPreview = vi.fn();
    render(<ProjectInspector editor={technologyEditor()} locale="en" loading={false} onSaved={vi.fn().mockResolvedValue(null)} onPreview={onPreview} onDirtyChange={vi.fn()} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Переместить ниже" })[0]!);
    expect(screen.getAllByLabelText("Название технологии").map((input) => (input as HTMLInputElement).value)).toEqual(["TypeScript", "React"]);
    expect(screen.getAllByLabelText("Slug технологии").map((input) => (input as HTMLInputElement).value)).toEqual(["typescript", "react"]);
    expect(onPreview).toHaveBeenLastCalledWith(expect.objectContaining({ technologies: [{ slug: "typescript", name: "TypeScript", sortOrder: 10 }, { slug: "react", name: "React", sortOrder: 20 }] }));
  });

  it("keeps a fully empty link row, blocks publish, and requires explicit deletion", () => {
    const value = draftEditor(); value.editable.content.links.push({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", url: "", sortOrder: 20, label: { ru: "", en: "" } });
    render(<ProjectInspector editor={value} locale="en" loading={false} onSaved={vi.fn().mockResolvedValue(null)} onPreview={vi.fn()} onDirtyChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Опубликовать" }));
    expect(screen.getByText("Удалите пустую ссылку или заполните её полностью.")).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: /Опубликовать изменения/ })).toBeNull();
    expect((screen.getAllByLabelText("Адрес ссылки")[1] as HTMLInputElement).value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Удалить ссылку 2" }));
    expect(screen.getAllByLabelText("Адрес ссылки")).toHaveLength(1);
  });

  it.each([
    ["empty URL", "", "Укажите HTTPS-адрес или внутренний якорь: #hero, #featured-projects, #skills, #services, #about, #contact."],
    ["domain without protocol", "www.example.com", "Укажите HTTPS-адрес или внутренний якорь: #hero, #featured-projects, #skills, #services, #about, #contact."],
    ["relative URL", "/project", "Укажите HTTPS-адрес или внутренний якорь: #hero, #featured-projects, #skills, #services, #about, #contact."],
    ["unsupported protocol", "mailto:test@example.com", "Укажите HTTPS-адрес или внутренний якорь: #hero, #featured-projects, #skills, #services, #about, #contact."],
  ])("blocks publish for %s without a publish request", (_name, url, message) => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const value = draftEditor(); value.editable.content.links[0]!.url = url;
    render(<ProjectInspector editor={value} locale="en" loading={false} onSaved={vi.fn().mockResolvedValue(null)} onPreview={vi.fn()} onDirtyChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Опубликовать" }));
    expect(screen.getByText(message)).toBeTruthy();
    expect(screen.getByLabelText("Адрес ссылки").getAttribute("aria-invalid")).toBe("true");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("maps missing localized labels to their own fields", () => {
    const ru = draftEditor(); ru.editable.content.links[0]!.label.ru = "";
    const first = render(<ProjectInspector editor={ru} locale="en" loading={false} onSaved={vi.fn().mockResolvedValue(null)} onPreview={vi.fn()} onDirtyChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Опубликовать" }));
    expect(screen.getByText("Укажите название ссылки на русском языке.")).toBeTruthy();
    expect(screen.getByLabelText("Название ссылки — русский").getAttribute("aria-invalid")).toBe("true");
    first.unmount();
    const en = draftEditor(); en.editable.content.links[0]!.label.en = "";
    render(<ProjectInspector editor={en} locale="en" loading={false} onSaved={vi.fn().mockResolvedValue(null)} onPreview={vi.fn()} onDirtyChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Опубликовать" }));
    expect(screen.getByText("Укажите название ссылки на английском языке.")).toBeTruthy();
    expect(screen.getByLabelText("Название ссылки — английский").getAttribute("aria-invalid")).toBe("true");
  });

  it("clears a link error after correction while leaving Save permissive", async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => new Response(JSON.stringify({ data: { revisionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", revisionNumber: 3, updatedAt: "2026-01-02T00:00:00.000Z" } }), { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);
    const value = draftEditor(); value.editable.content.links[0]!.url = "www.example.com";
    render(<ProjectInspector editor={value} locale="en" loading={false} onSaved={vi.fn().mockResolvedValue(null)} onPreview={vi.fn()} onDirtyChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Опубликовать" }));
    fireEvent.change(screen.getByLabelText("Адрес ссылки"), { target: { value: "https://example.com" } });
    expect(screen.queryByText("Укажите HTTPS-адрес или внутренний якорь: #hero, #featured-projects, #skills, #services, #about, #contact.")).toBeNull();
    fireEvent.change(screen.getByLabelText("Адрес ссылки"), { target: { value: "www.example.com" } });
    fireEvent.change(screen.getByLabelText("Название ссылки — русский"), { target: { value: "Открыть ссылку" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить черновик" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch.mock.calls[0]?.[1]?.method).toBe("PUT");
  });

  it("accepts an HTTPS link for publish and preserves backend error fallback", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => new Response(JSON.stringify({ error: { code: "PUBLISH_VALIDATION_FAILED", message: "Other publication requirement." } }), { status: 400, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);
    const value = draftEditor(); value.editable.content.links[0]!.url = "https://example.com";
    render(<ProjectInspector editor={value} locale="en" loading={false} onSaved={vi.fn().mockResolvedValue(null)} onPreview={vi.fn()} onDirtyChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Опубликовать" }));
    expect(screen.getByRole("dialog", { name: /Опубликовать изменения/ })).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Опубликовать" })[1]!);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch.mock.calls[0]?.[1]?.method).toBe("POST");
    expect((await screen.findAllByText("Other publication requirement.")).length).toBeGreaterThan(0);
  });

  it("accepts a valid HTTPS link for publication confirmation", () => {
    const value = draftEditor(); value.editable.content.links[0]!.url = "https://example.com";
    render(<ProjectInspector editor={value} locale="en" loading={false} onSaved={vi.fn().mockResolvedValue(null)} onPreview={vi.fn()} onDirtyChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Опубликовать" }));
    expect(screen.getByRole("dialog", { name: /Опубликовать изменения/ })).toBeTruthy();
  });

  it("opens publish confirmation after correcting the later backend-canonical duplicate link", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => new Response(JSON.stringify({ data: { revisionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", revisionNumber: 3, updatedAt: "2026-01-02T00:00:00.000Z", publishedAt: "2026-01-02T00:00:00.000Z" } }), { headers: { "content-type": "application/json" } })); vi.stubGlobal("fetch", fetch);
    const duplicateId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const value = draftEditor(); value.editable.content.links[0]!.url = "https://example.com"; value.editable.content.links.push({ id: duplicateId, url: "https://example.com/", sortOrder: 20, label: { ru: "Дубликат", en: "Duplicate" } });
    const saved = draftEditor(); saved.editable.content.links[0]!.url = "https://example.com"; saved.editable.content.links.push({ id: duplicateId, url: "https://example.org/", sortOrder: 20, label: { ru: "Дубликат", en: "Duplicate" } }); saved.editable = { ...saved.editable, revisionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" }; saved.draft = { ...saved.draft!, revisionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" };
    const onPreview = vi.fn(); const onSaved = vi.fn().mockResolvedValue(saved);
    render(<ProjectInspector editor={value} locale="en" loading={false} onSaved={onSaved} onPreview={onPreview} onDirtyChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Опубликовать" }));
    const [first, second] = screen.getAllByLabelText("Адрес ссылки") as HTMLInputElement[];
    expect(first.getAttribute("aria-invalid")).toBeNull();
    expect(second.getAttribute("aria-invalid")).toBe("true");
    expect(second.getAttribute("aria-describedby")).toBe(`link-error-${duplicateId}-url`);
    expect(screen.getByText("Эта ссылка уже добавлена.")).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: /Опубликовать изменения/ })).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getAllByLabelText("Адрес ссылки")).toHaveLength(2);
    fireEvent.change(second, { target: { value: "https://example.org/" } });
    expect(screen.queryByText("Эта ссылка уже добавлена.")).toBeNull();
    expect(second.getAttribute("aria-invalid")).toBeNull();
    expect(first.getAttribute("aria-invalid")).toBeNull();
    expect(onPreview).toHaveBeenLastCalledWith(expect.objectContaining({ links: expect.arrayContaining([expect.objectContaining({ id: duplicateId, url: "https://example.org/" })]) }));
    fireEvent.click(screen.getByRole("button", { name: "Сохранить черновик" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetch.mock.calls[0]?.[1]?.body as string).content.links).toEqual(expect.arrayContaining([expect.objectContaining({ id: duplicateId, url: "https://example.org/" })]));
    fireEvent.click(screen.getByRole("button", { name: "Опубликовать" }));
    expect(screen.getByRole("dialog", { name: /Опубликовать изменения/ })).toBeTruthy();
    expect(fetch.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0);
    fireEvent.click(screen.getAllByRole("button", { name: "Опубликовать" })[1]!);
    await waitFor(() => expect(fetch.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1));
    expect(screen.queryByText("Эта ссылка уже добавлена.")).toBeNull();
  });

  it.each([
    ["unknown fragment URL", "#section", "Используйте один из разрешённых внутренних якорей: #hero, #featured-projects, #skills, #services, #about, #contact."],
    ["tel URL", "tel:+123456789", "Укажите HTTPS-адрес или внутренний якорь: #hero, #featured-projects, #skills, #services, #about, #contact."],
    ["FTP URL", "ftp://example.com/file", "Укажите HTTPS-адрес или внутренний якорь: #hero, #featured-projects, #skills, #services, #about, #contact."],
  ])("blocks %s without a publish request", (_name, url, message) => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const value = draftEditor(); value.editable.content.links[0]!.url = url;
    render(<ProjectInspector editor={value} locale="en" loading={false} onSaved={vi.fn().mockResolvedValue(null)} onPreview={vi.fn()} onDirtyChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Опубликовать" }));
    expect(screen.getByText(message)).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("uses a trimmed whitespace-wrapped URL for publish without silently changing the field", async () => {
    const fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => new Response(JSON.stringify({ data: {} }), { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);
    const value = draftEditor(); value.editable.content.links[0]!.url = "  https://example.com/path  ";
    render(<ProjectInspector editor={value} locale="en" loading={false} onSaved={vi.fn().mockResolvedValue(null)} onPreview={vi.fn()} onDirtyChange={vi.fn()} />);
    const input = screen.getByLabelText("Адрес ссылки") as HTMLInputElement;
    expect(input.value).toBe("  https://example.com/path  ");
    fireEvent.click(screen.getByRole("button", { name: "Опубликовать" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Опубликовать" })[1]!);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch.mock.calls[0]?.[1]?.method).toBe("POST");
    expect(input.value).toBe("  https://example.com/path  ");
  });

  it("clears a deleted row error and permits the remaining valid link", () => {
    const invalidId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const value = draftEditor(); value.editable.content.links.push({ id: invalidId, url: "www.example.com", sortOrder: 20, label: { ru: "Плохая", en: "Bad" } });
    const rendered = render(<ProjectInspector editor={value} locale="en" loading={false} onSaved={vi.fn().mockResolvedValue(null)} onPreview={vi.fn()} onDirtyChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Опубликовать" }));
    expect(document.getElementById(`link-error-${invalidId}-url`)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Удалить ссылку 2" }));
    expect(screen.getAllByLabelText("Адрес ссылки")).toHaveLength(1);
    expect(document.getElementById(`link-error-${invalidId}-url`)).toBeNull();
    expect(screen.getByLabelText("Адрес ссылки").getAttribute("aria-invalid")).toBeNull();
    const saved = draftEditor(); saved.editable = { ...saved.editable, revisionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" }; saved.draft = { ...saved.draft!, revisionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" };
    rendered.rerender(<ProjectInspector editor={saved} locale="en" loading={false} onSaved={vi.fn().mockResolvedValue(null)} onPreview={vi.fn()} onDirtyChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Опубликовать" }));
    expect(screen.getByRole("dialog", { name: /Опубликовать изменения/ })).toBeTruthy();
  });

  it("connects each invalid URL to its own unique accessible error", () => {
    const secondId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const value = draftEditor(); value.editable.content.links[0]!.url = "www.example.com"; value.editable.content.links.push({ id: secondId, url: "/second", sortOrder: 20, label: { ru: "Плохая", en: "Bad" } });
    render(<ProjectInspector editor={value} locale="en" loading={false} onSaved={vi.fn().mockResolvedValue(null)} onPreview={vi.fn()} onDirtyChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Опубликовать" }));
    const [first, second] = screen.getAllByLabelText("Адрес ссылки") as HTMLInputElement[];
    const firstId = first.getAttribute("aria-describedby"); const secondErrorId = second.getAttribute("aria-describedby");
    expect(first.getAttribute("aria-invalid")).toBe("true");
    expect(second.getAttribute("aria-invalid")).toBe("true");
    expect(firstId).toBe("link-error-99999999-9999-4999-8999-999999999999-url");
    expect(secondErrorId).toBe(`link-error-${secondId}-url`);
    expect(firstId).not.toBe(secondErrorId);
    expect(document.getElementById(firstId!)).toBeTruthy();
    expect(document.getElementById(secondErrorId!)).toBeTruthy();
  });

  it("preserves focused invalid URL input while rendering publication errors", () => {
    const value = draftEditor(); value.editable.content.links[0]!.url = "www.example.com";
    render(<ProjectInspector editor={value} locale="en" loading={false} onSaved={vi.fn().mockResolvedValue(null)} onPreview={vi.fn()} onDirtyChange={vi.fn()} />);
    const input = screen.getByLabelText("Адрес ссылки") as HTMLInputElement;
    input.focus();
    fireEvent.click(screen.getByRole("button", { name: "Опубликовать" }));
    expect(screen.getByLabelText("Адрес ссылки")).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe("www.example.com");
  });

  it("revalidates a parent-provided fresh editor state when confirming publication", () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const initial = draftEditor();
    const rendered = render(<ProjectInspector editor={initial} locale="en" loading={false} onSaved={vi.fn().mockResolvedValue(null)} onPreview={vi.fn()} onDirtyChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Опубликовать" }));
    expect(screen.getByRole("dialog", { name: /Опубликовать изменения/ })).toBeTruthy();
    const refreshed = draftEditor(); refreshed.editable.content.links[0]!.url = "www.example.com"; refreshed.editable = { ...refreshed.editable, revisionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" }; refreshed.draft = { ...refreshed.draft!, revisionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" };
    rendered.rerender(<ProjectInspector editor={refreshed} locale="en" loading={false} onSaved={vi.fn().mockResolvedValue(null)} onPreview={vi.fn()} onDirtyChange={vi.fn()} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Опубликовать" })[1]!);
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: /Опубликовать изменения/ })).toBeNull();
    expect(screen.getByText("Укажите HTTPS-адрес или внутренний якорь: #hero, #featured-projects, #skills, #services, #about, #contact.")).toBeTruthy();
  });

  it.each(["#hero", "#featured-projects", "#skills", "#services", "#about", "#contact"])("accepts allowlisted anchor %s for publication confirmation", (url) => {
    const value = draftEditor(); value.editable.content.links[0]!.url = url;
    render(<ProjectInspector editor={value} locale="en" loading={false} onSaved={vi.fn().mockResolvedValue(null)} onPreview={vi.fn()} onDirtyChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Опубликовать" }));
    expect(screen.getByRole("dialog", { name: /Опубликовать изменения/ })).toBeTruthy();
  });

  it.each([
    ["HTTP", "http://example.com", "Внешние ссылки должны начинаться с https://."],
    ["protocol-relative", "//example.com", "Укажите HTTPS-адрес или внутренний якорь: #hero, #featured-projects, #skills, #services, #about, #contact."],
    ["empty anchor", "#", "Используйте один из разрешённых внутренних якорей: #hero, #featured-projects, #skills, #services, #about, #contact."],
    ["uppercase anchor", "#CONTACT", "Используйте один из разрешённых внутренних якорей: #hero, #featured-projects, #skills, #services, #about, #contact."],
    ["anchor with whitespace", "#con tact", "Используйте один из разрешённых внутренних якорей: #hero, #featured-projects, #skills, #services, #about, #contact."],
    ["unsafe scheme", "javascript:alert(1)", "Укажите HTTPS-адрес или внутренний якорь: #hero, #featured-projects, #skills, #services, #about, #contact."],
  ])("rejects %s without opening confirmation or posting", (_name, url, message) => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const value = draftEditor(); value.editable.content.links[0]!.url = url;
    render(<ProjectInspector editor={value} locale="en" loading={false} onSaved={vi.fn().mockResolvedValue(null)} onPreview={vi.fn()} onDirtyChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Опубликовать" }));
    expect(screen.getByText(message)).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: /Опубликовать изменения/ })).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects only the later duplicate anchor and clears its error after a real correction", () => {
    const duplicateId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const value = draftEditor(); value.editable.content.links[0]!.url = "#contact"; value.editable.content.links.push({ id: duplicateId, url: "#contact", sortOrder: 20, label: { ru: "Контакт", en: "Contact" } });
    render(<ProjectInspector editor={value} locale="en" loading={false} onSaved={vi.fn().mockResolvedValue(null)} onPreview={vi.fn()} onDirtyChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Опубликовать" }));
    const [first, second] = screen.getAllByLabelText("Адрес ссылки") as HTMLInputElement[];
    expect(first.getAttribute("aria-invalid")).toBeNull();
    expect(second.getAttribute("aria-invalid")).toBe("true");
    expect(second.getAttribute("aria-describedby")).toBe(`link-error-${duplicateId}-url`);
    fireEvent.change(second, { target: { value: "#about" } });
    expect(second.getAttribute("aria-invalid")).toBeNull();
    expect(screen.queryByText("Эта ссылка уже добавлена.")).toBeNull();
  });

  it("keeps anchor and HTTPS URL with the same hash in separate canonical classes", () => {
    const value = draftEditor(); value.editable.content.links[0]!.url = "#contact"; value.editable.content.links.push({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", url: "https://example.com/#contact", sortOrder: 20, label: { ru: "Сайт", en: "Site" } });
    render(<ProjectInspector editor={value} locale="en" loading={false} onSaved={vi.fn().mockResolvedValue(null)} onPreview={vi.fn()} onDirtyChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Опубликовать" }));
    expect(screen.getByRole("dialog", { name: /Опубликовать изменения/ })).toBeTruthy();
  });

  it("keeps second-row errors with the link identity through reorder", () => {
    const value = draftEditor(); value.editable.content.links.push({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", url: "www.example.com", sortOrder: 20, label: { ru: "Плохая", en: "Bad" } });
    render(<ProjectInspector editor={value} locale="en" loading={false} onSaved={vi.fn().mockResolvedValue(null)} onPreview={vi.fn()} onDirtyChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Опубликовать" }));
    expect(screen.getAllByLabelText("Адрес ссылки")[1]!.getAttribute("aria-invalid")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Переместить ссылку 2 выше" }));
    expect((screen.getAllByLabelText("Адрес ссылки")[0] as HTMLInputElement).value).toBe("www.example.com");
    expect(screen.getAllByLabelText("Адрес ссылки")[0]!.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getAllByLabelText("Адрес ссылки")[1]!.getAttribute("aria-invalid")).toBeNull();
  });
});
