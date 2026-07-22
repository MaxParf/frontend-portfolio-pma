import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { LoginScreen } from "./LoginScreen";
import { CmsShell } from "./CmsShell";
import type { AdminProject } from "../api/types";

const owner = { id: "owner-id", displayName: "Maksim", role: "owner" as const };

const project: AdminProject = {
  id: "project-bradbury",
  databaseId: "db-id",
  slug: "project-bradbury",
  galleryId: "bradbury",
  status: "published",
  sortOrder: 20,
  type: "quiet-social-platform",
  startedAt: null,
  endedAt: null,
  isOngoing: true,
  createdAt: "2026-07-22T00:00:00.000Z",
  updatedAt: "2026-07-22T00:00:00.000Z",
  publishedAt: "2026-07-22T00:00:00.000Z",
  links: { primary: { href: "https://prbdbr.com/", type: "website" }, secondary: null },
  translations: {
    en: {
      title: "Project Bradbury",
      subtitle: null,
      description: "English description",
      role: "Founder",
      statusLabel: "Closed Alpha",
      primaryActionLabel: "Live platform",
      secondaryActionLabel: null,
      technologiesTitle: null,
    },
    ru: {
      title: "Project Bradbury",
      subtitle: null,
      description: "Русское описание",
      role: "Founder",
      statusLabel: "Закрытое тестирование",
      primaryActionLabel: "Открыть платформу",
      secondaryActionLabel: null,
      technologiesTitle: null,
    },
  },
  technologies: ["React", "TypeScript"],
  media: [
    {
      id: "project-bradbury:mobile-home",
      src: "images/projects/bradbury/mobile_home_feed.webp",
      role: "gallery",
      sortOrder: 10,
      translations: {
        en: { alt: "Mobile feed", ariaLabel: "Open screenshot" },
        ru: { alt: "Мобильная лента", ariaLabel: "Открыть скриншот" },
      },
    },
  ],
};

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

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Email and password are required.");
    expect(onLogin).not.toHaveBeenCalled();
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

    expect(await screen.findByRole("heading", { name: "Maxpar CMS" })).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
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
    expect(screen.getByText("Published data preview")).toBeTruthy();
  });
});

describe("CmsShell", () => {
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

    fireEvent.click(screen.getAllByRole("button", { name: "Logout" })[1]);
    expect(onLogout).toHaveBeenCalled();
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

    expect(screen.getByText("Maxpar CMS is available on desktop screens with a minimum width of 1200 px.")).toBeTruthy();
  });
});
