import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { LoginScreen } from "./LoginScreen";
import { CmsShell } from "./CmsShell";
import { AccessibleDialog } from "./AccessibleDialog";
import { logout } from "../api/auth";
import type { AdminProject } from "../api/types";

const owner = { id: "owner-id", login: "@maxpar.fed", displayName: "Maksim", role: "owner" as const };

const project: AdminProject = {
  id: "project-bradbury",
  databaseId: "11111111-1111-4111-8111-111111111111",
  slug: "project-bradbury",
  galleryId: "bradbury",
  status: "published",
  sortOrder: 20,
  createdAt: "2026-07-22T00:00:00.000Z",
  updatedAt: "2026-07-22T00:00:00.000Z",
  publishedAt: "2026-07-22T00:00:00.000Z",
  isPublished: true,
  hasDraft: false,
  translations: {
    status: "published",
    values: { en: { title: "Project Bradbury" }, ru: { title: "Проект Брэдбери" } },
  },
};

const editorPayload = {
  data: {
    project: { id: "11111111-1111-4111-8111-111111111111", externalKey: "project:bradbury", slug: "project-bradbury", status: "published" },
    published: { revisionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", revisionNumber: 1, revisionType: "published", baseRevisionId: null, createdAt: "2026-07-22T00:00:00.000Z", updatedAt: "2026-07-22T00:00:00.000Z", publishedAt: "2026-07-22T00:00:00.000Z", content: { slug: "project-bradbury", galleryId: "bradbury", sortOrder: 20, projectType: null, dates: { startedAt: null, endedAt: null, ongoing: true }, translations: { en: { title: "Project Bradbury", subtitle: null, description: "Description", role: "Founder", statusLabel: "Published", technologiesTitle: null, displayType: "Case" }, ru: { title: "Проект Брэдбери", subtitle: null, description: "Описание", role: "Основатель", statusLabel: "Опубликовано", technologiesTitle: null, displayType: "Кейс" } }, technologies: [], links: [], features: [], notes: [], media: [] } },
    draft: null,
    editable: { source: "published", revisionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", content: { slug: "project-bradbury", galleryId: "bradbury", sortOrder: 20, projectType: null, dates: { startedAt: null, endedAt: null, ongoing: true }, translations: { en: { title: "Project Bradbury", subtitle: null, description: "Description", role: "Founder", statusLabel: "Published", technologiesTitle: null, displayType: "Case" }, ru: { title: "Проект Брэдбери", subtitle: null, description: "Описание", role: "Основатель", statusLabel: "Опубликовано", technologiesTitle: null, displayType: "Кейс" } }, technologies: [], links: [], features: [], notes: [], media: [] } },
    meta: { hasUnpublishedChanges: false }, localePublicationCapability: "legacy",
    publicationState: { ru: { status: "published", publishedRevisionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", publishedAt: "2026-07-22T00:00:00.000Z", publicationGeneration: 0, hasUnpublishedChanges: false, isPublishable: true }, en: { status: "published", publishedRevisionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", publishedAt: "2026-07-22T00:00:00.000Z", publicationGeneration: 0, hasUnpublishedChanges: false, isPublishable: true } },
  },
};

const draftEditorPayload: any = structuredClone(editorPayload);
draftEditorPayload.data.draft = { ...draftEditorPayload.data.published, revisionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", revisionNumber: 2, revisionType: "draft", baseRevisionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", publishedAt: null };
draftEditorPayload.data.editable = { source: "draft", revisionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", content: draftEditorPayload.data.draft.content };
draftEditorPayload.data.meta = { hasUnpublishedChanges: true };

const unpublishedProject: AdminProject = { ...project, id: "new-project-id", databaseId: "22222222-2222-4222-8222-222222222222", slug: "new-project-unpublished", status: "draft", publishedAt: null, isPublished: false, hasDraft: true };
const unpublishedEditorPayload: any = structuredClone(draftEditorPayload);
unpublishedEditorPayload.data.project = { id: unpublishedProject.databaseId, externalKey: unpublishedProject.id, slug: unpublishedProject.slug, status: "draft" };
unpublishedEditorPayload.data.published = null;
unpublishedEditorPayload.data.draft.baseRevisionId = null;
unpublishedEditorPayload.data.draft.content.slug = unpublishedProject.slug;
unpublishedEditorPayload.data.editable = { source: "draft", revisionId: unpublishedEditorPayload.data.draft.revisionId, content: unpublishedEditorPayload.data.draft.content };
unpublishedEditorPayload.data.publicationState = { ru: { status: "not_published", publishedRevisionId: null, publishedAt: null, publicationGeneration: 0, hasUnpublishedChanges: true, isPublishable: false }, en: { status: "not_published", publishedRevisionId: null, publishedAt: null, publicationGeneration: 0, hasUnpublishedChanges: true, isPublishable: false } };


function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => handler(String(input), init)),
  );
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

describe("LoginScreen", () => {
  it("validates required login form fields", async () => {
    const onLogin = vi.fn();
    render(<LoginScreen apiBaseUrl="http://127.0.0.1:3001" onLogin={onLogin} />);

    fireEvent.click(screen.getByRole("button", { name: "Войти" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Введите логин и пароль.");
    expect(onLogin).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Логин").getAttribute("autocomplete")).toBe("username");
    expect(screen.getByLabelText("Пароль").getAttribute("autocomplete")).toBe("current-password");
    expect(screen.queryByText(/create account|sign up|forgot password|register/i)).toBeNull();
  });

  it("submits owner login and shows a generic login error", async () => {
    const onLogin = vi.fn().mockRejectedValue(new Error("Authentication failed."));
    render(<LoginScreen apiBaseUrl="http://127.0.0.1:3001" onLogin={onLogin} />);

    fireEvent.change(screen.getByLabelText("Логин"), { target: { value: "@maxpar.fed" } });
    fireEvent.change(screen.getByLabelText("Пароль"), { target: { value: "not-real-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Войти" }));

    await waitFor(() => expect(onLogin).toHaveBeenCalledWith("@maxpar.fed", "not-real-password"));
    expect((await screen.findByRole("alert")).textContent).toContain("Не удалось выполнить вход.");
  });
});

describe("App", () => {
  it("renders login when unauthenticated", async () => {
    mockFetch((url) => {
      if (url.endsWith("/api/v1/admin/auth/me")) {
        return json({ error: { message: "Authentication required." } }, 401);
      }
      return json({});
    });

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Вход в CMS" })).toBeTruthy();
    expect(screen.getByLabelText("Логин")).toBeTruthy();
  });

  it("keeps controlled login values after the initial unauthenticated session check", async () => {
    mockFetch((url) => url.endsWith("/api/v1/admin/auth/me")
      ? json({ error: { message: "Authentication required." } }, 401)
      : json({}));
    render(<App />);
    const login = await screen.findByLabelText("Логин");
    const password = screen.getByLabelText("Пароль");
    fireEvent.change(login, { target: { value: "test-input" } });
    fireEvent.change(password, { target: { value: "test-password" } });
    expect((login as HTMLInputElement).value).toBe("test-input");
    expect((password as HTMLInputElement).value).toBe("test-password");
    expect(login.hasAttribute("readonly")).toBe(false);
    expect((login as HTMLInputElement).disabled).toBe(false);
    expect((password as HTMLInputElement).disabled).toBe(false);
  });

  it("loads authenticated shell and project list", async () => {
    mockFetch((url) => {
      if (url.endsWith("/api/v1/admin/auth/me")) {
        return json({ data: owner });
      }
      if (url.endsWith("/api/v1/admin/projects")) {
        return json({ data: [project], meta: { count: 1 } });
      }
      return json({});
    });

    render(<App />);

    expect(await screen.findByTestId("cms-shell")).toBeTruthy();
    await waitFor(() => expect(screen.getAllByText("Project Bradbury").length).toBeGreaterThan(0));
    expect(screen.getByText("Предпросмотр")).toBeTruthy();
    expect(screen.getByText("@maxpar.fed")).toBeTruthy();
  });

  it("loads a published project without draft through the editable editor endpoint", async () => {
    const fetchSpy = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/v1/admin/auth/me")) return json({ data: owner });
      if (url.endsWith("/api/v1/admin/projects")) return json({ data: [project], meta: { count: 1 } });
      if (url.endsWith("/api/v1/admin/projects/project-bradbury/editor")) return json(editorPayload);
      if (url.endsWith("/api/v1/admin/projects/project-bradbury/published")) throw new Error("published endpoint must not be authoring source");
      return json({});
    });
    vi.stubGlobal("fetch", fetchSpy);

    render(<App />);

    const title = await screen.findByLabelText("Название — русский");
    expect((title as HTMLInputElement).value).toBe("Проект Брэдбери");
    expect(screen.queryByText("Черновик отсутствует.")).toBeNull();
    expect(screen.getByRole("heading", { name: "Предпросмотр" })).toBeTruthy();
    expect(screen.queryByText("Предпросмотр черновика")).toBeNull();
    expect(screen.getByRole("button", { name: "Сохранить черновик" })).toBeTruthy();
    expect(fetchSpy.mock.calls.some(([input]) => String(input).endsWith("/api/v1/admin/projects/project-bradbury/editor"))).toBe(true);
    expect(fetchSpy.mock.calls.some(([input]) => String(input).endsWith("/api/v1/admin/projects/project-bradbury/published"))).toBe(false);
  });

  it("keeps the published baseline form after preview updates rerender App", async () => {
    const fetchSpy = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/v1/admin/auth/me")) return json({ data: owner });
      if (url.endsWith("/api/v1/admin/projects")) return json({ data: [project], meta: { count: 1 } });
      if (url.endsWith("/api/v1/admin/projects/project-bradbury/editor")) return json(editorPayload);
      if (url.endsWith("/api/v1/admin/projects/project-bradbury/published")) throw new Error("published endpoint must not be authoring source");
      if (url.endsWith("/api/v1/admin/projects/project-bradbury/draft/from-published")) throw new Error("create-from-published must not be used");
      return json({});
    });
    vi.stubGlobal("fetch", fetchSpy);

    render(<App />);

    const title = await screen.findByLabelText("Название — английский");
    fireEvent.change(title, { target: { value: "Первое несохранённое название" } });
    expect(await screen.findByRole("heading", { name: "Первое несохранённое название", level: 3 })).toBeTruthy();
    expect((title as HTMLInputElement).value).toBe("Первое несохранённое название");

    fireEvent.change(title, { target: { value: "Второе несохранённое название" } });
    expect(await screen.findByRole("heading", { name: "Второе несохранённое название", level: 3 })).toBeTruthy();
    expect((title as HTMLInputElement).value).toBe("Второе несохранённое название");
    expect(fetchSpy.mock.calls.some(([input]) => String(input).endsWith("/api/v1/admin/projects/project-bradbury/editor"))).toBe(true);
    expect(fetchSpy.mock.calls.some(([input]) => String(input).endsWith("/api/v1/admin/projects/project-bradbury/published"))).toBe(false);
    expect(fetchSpy.mock.calls.some(([input]) => String(input).endsWith("/api/v1/admin/projects/project-bradbury/draft/from-published"))).toBe(false);
  });

  it("refreshes discard to the editable published baseline through the editor endpoint", async () => {
    let listCalls = 0;
    let editorCalls = 0;
    const fetchSpy = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/v1/admin/auth/me")) return json({ data: owner });
      if (url.endsWith("/api/v1/admin/projects")) {
        listCalls += 1;
        return json({ data: [{ ...project, hasDraft: listCalls === 1 }], meta: { count: 1 } });
      }
      if (url.endsWith("/api/v1/admin/projects/project-bradbury/editor")) {
        editorCalls += 1;
        return json(editorCalls === 1 ? draftEditorPayload : editorPayload);
      }
      if (url.endsWith("/api/v1/admin/projects/project-bradbury/draft") && init?.method === "DELETE") return new Response(null, { status: 204 });
      return json({});
    });
    vi.stubGlobal("fetch", fetchSpy);

    render(<App />);

    await screen.findByRole("button", { name: "Удалить черновик" });
    fireEvent.click(screen.getByRole("button", { name: "Удалить черновик" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Удалить черновик" })[1]!);
    await waitFor(() => expect(editorCalls).toBe(2));
    expect((screen.getByLabelText("Название — русский") as HTMLInputElement).value).toBe("Проект Брэдбери");
    expect(screen.queryByText("Черновик отсутствует.")).toBeNull();
    expect(fetchSpy.mock.calls.some(([input]) => String(input).endsWith("/api/v1/admin/projects/project-bradbury/published"))).toBe(false);
  });

  it("removes a deleted unpublished project from selection before loading a surviving editor", async () => {
    let listCalls = 0;
    const fetchSpy = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/v1/admin/auth/me")) return json({ data: owner });
      if (url.endsWith("/api/v1/admin/projects")) { listCalls += 1; return json({ data: listCalls === 1 ? [unpublishedProject, project] : [project], meta: { count: 1 } }); }
      if (url.endsWith("/api/v1/admin/projects/new-project-unpublished/editor")) return json(unpublishedEditorPayload);
      if (url.endsWith("/api/v1/admin/projects/new-project-unpublished") && init?.method === "DELETE") return new Response(null, { status: 204 });
      if (url.endsWith("/api/v1/admin/projects/project-bradbury/editor")) return json(editorPayload);
      return json({});
    });
    vi.stubGlobal("fetch", fetchSpy);
    render(<App />);
    await screen.findByRole("button", { name: "Удалить проект" });
    fireEvent.click(screen.getByRole("button", { name: "Удалить проект" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Удалить проект" })[1]!);
    await screen.findByDisplayValue("Проект Брэдбери");
    expect(screen.queryByText("new-project-unpublished")).toBeNull();
    expect(fetchSpy.mock.calls.filter(([input]) => String(input).endsWith("/api/v1/admin/projects/new-project-unpublished/editor"))).toHaveLength(1);
  });

});

describe("CmsShell", () => {
  it("uses the neutral preview label when a persisted draft exists", () => {
    render(
      <CmsShell
        user={owner}
        projects={[{ ...project, hasDraft: true }]}
        projectsStatus="ready"
        projectsError={null}
        selectedProject={{ ...project, hasDraft: true }}
        selectedProjectId={project.id}
        editor={draftEditorPayload.data}
        previewContent={draftEditorPayload.data.editable.content}
        locale="ru"
        activityEvents={[]}
        apiBaseUrl="http://127.0.0.1:3001"
        onRetryProjects={vi.fn()}
        onProjectSelected={vi.fn()}
        onLocaleChanged={vi.fn()}
        onLogout={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Предпросмотр" })).toBeTruthy();
    expect(screen.queryByText("Предпросмотр черновика")).toBeNull();
  });

  it("switches preview locale and calls logout", () => {
    const onLocaleChanged = vi.fn();
    const onLogout = vi.fn();

    render(
      <CmsShell
        user={owner}
        projects={[project]}
        projectsStatus="ready"
        projectsError={null}
        selectedProject={project}
        selectedProjectId={project.id}
        locale="en"
        activityEvents={[]}
        apiBaseUrl="http://127.0.0.1:3001"
        onRetryProjects={vi.fn()}
        onProjectSelected={vi.fn()}
        onLocaleChanged={onLocaleChanged}
        onLogout={onLogout}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "RU" }));
    expect(onLocaleChanged).toHaveBeenCalledWith("ru");

    fireEvent.click(screen.getByRole("button", { name: "Выйти" }));
    expect(onLogout).toHaveBeenCalled();
    expect(screen.getByText("@maxpar.fed")).toBeTruthy();
    expect(screen.getByText("Владелец")).toBeTruthy();
  });

  it("renders desktop gate message", () => {
    render(
      <CmsShell
        user={owner}
        projects={[project]}
        projectsStatus="ready"
        projectsError={null}
        selectedProject={project}
        selectedProjectId={project.id}
        locale="en"
        activityEvents={[]}
        apiBaseUrl="http://127.0.0.1:3001"
        onRetryProjects={vi.fn()}
        onProjectSelected={vi.fn()}
        onLocaleChanged={vi.fn()}
        onLogout={vi.fn()}
      />,
    );

    expect(screen.queryByText("Maxpar CMS доступна только на настольных компьютерах.")).toBeNull();
  });
});

describe("AccessibleDialog", () => {
  it("exposes modal semantics and traps tab navigation", () => {
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();
    const onCancel = vi.fn();
    const view = render(<AccessibleDialog title="Publish changes?" description="Public data will change." confirmLabel="Publish" onCancel={onCancel} onConfirm={vi.fn()} />);
    const dialog = screen.getByRole("dialog");
    const cancel = screen.getByRole("button", { name: "Отмена" });
    const publish = screen.getByRole("button", { name: "Publish" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement).toBe(cancel);
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(publish);
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(cancel);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it("does not dismiss while a publish request is in progress", () => {
    const onCancel = vi.fn();
    render(<AccessibleDialog title="Publish changes?" description="Public data will change." confirmLabel="Publish" busy onCancel={onCancel} onConfirm={vi.fn()} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Выполняется..." }).hasAttribute("disabled")).toBe(true);
  });
});

describe("auth API client", () => {
  it("does not send JSON content type for empty logout request", async () => {
    const fetchSpy = vi.fn(() => json({ data: { loggedOut: true } }));
    vi.stubGlobal("fetch", fetchSpy);

    await logout();

    const [, init] = fetchSpy.mock.calls[0] as unknown as [RequestInfo | URL, RequestInit | undefined];
    expect(init).toBeDefined();
    if (!init) {
      throw new Error("logout request init was not captured");
    }
    expect(init.method).toBe("POST");
    expect(init.body).toBeUndefined();
    expect(new Headers(init.headers).has("content-type")).toBe(false);
  });
});
