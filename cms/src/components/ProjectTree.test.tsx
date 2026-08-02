import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { AdminProject } from "../api/types";
import { ProjectTree } from "./ProjectTree";

const base = {
  databaseId: "11111111-1111-4111-8111-111111111111", galleryId: "gallery", sortOrder: 10,
  createdAt: "2026-07-27T00:00:00.000Z", updatedAt: "2026-07-27T00:00:00.000Z", publishedAt: null,
};

const blankDraft: AdminProject = {
  ...base, id: "draft:db-id", slug: "new-project-db-id", status: "draft", isPublished: false, hasDraft: true, translations: { status: "draft", values: {} },
};

const publishedProject: AdminProject = {
  ...base, id: "project-bradbury", slug: "project-bradbury", status: "published", isPublished: true, hasDraft: false,
  translations: { status: "published", values: { en: { title: "Project Bradbury" }, ru: { title: "Проект Брэдбери" } } },
};

function renderTree(projects: AdminProject[]) {
  return render(<ProjectTree projects={projects} status="ready" error={null} selectedProjectId={null} onRetry={vi.fn()} onProjectSelected={vi.fn()} onCreateProject={vi.fn()} />);
}

describe("ProjectTree", () => {
  it("renders an untouched draft without translations using the Russian temporary label", () => {
    renderTree([blankDraft]);
    expect(screen.getByText("Новый проект")).toBeTruthy();
  });

  it("renders the real title for a published project", () => {
    renderTree([publishedProject]);
    expect(screen.getByText("Project Bradbury")).toBeTruthy();
  });

  it("updates a draft tree title after title input", () => {
    function TreeEditor() {
      const [title, setTitle] = useState("");
      const draft = title ? { ...blankDraft, translations: { status: "draft" as const, values: { ru: { title } } } } : blankDraft;
      return <><input aria-label="Название — русский" value={title} onChange={(event) => setTitle(event.target.value)} /><ProjectTree projects={[draft]} status="ready" error={null} selectedProjectId={null} onRetry={vi.fn()} onProjectSelected={vi.fn()} onCreateProject={vi.fn()} /></>;
    }
    render(<TreeEditor />);
    fireEvent.change(screen.getByLabelText("Название — русский"), { target: { value: "Новый заголовок" } });
    expect(screen.getByText("Новый заголовок")).toBeTruthy();
  });
});
