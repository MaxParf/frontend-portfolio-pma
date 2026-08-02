import { useCallback, useEffect, useMemo, useState } from "react";
import { getCurrentUser, login as loginRequest, logout as logoutRequest } from "../api/auth";
import { ApiError, API_BASE_URL } from "../api/client";
import { createProject, getEditor, listProjects } from "../api/projects";
import type { AdminProject, AdminUser, DraftContent, Locale, ProjectEditor } from "../api/types";
import { LoginScreen } from "./LoginScreen";
import { CmsShell } from "./CmsShell";
import { AccessibleDialog } from "./AccessibleDialog";
import { projectDisplayTitle } from "./project-display-title";

export type AuthState =
  | { status: "checking" }
  | { status: "anonymous"; message?: string }
  | { status: "authenticated"; user: AdminUser };

export interface ActivityEvent {
  id: string;
  label: string;
  createdAt: string;
}

function activity(label: string): ActivityEvent {
  return { id: crypto.randomUUID(), label, createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
}

export function App() {
  const [auth, setAuth] = useState<AuthState>({ status: "checking" });
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [projectsStatus, setProjectsStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [locale, setLocale] = useState<Locale>("en");
  const [editor, setEditor] = useState<ProjectEditor | null>(null);
  const [editorLoading, setEditorLoading] = useState(false);
  const [previewContent, setPreviewContent] = useState<DraftContent | null>(null);
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [editorDirty, setEditorDirty] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: "switch"; projectId: string } | { type: "create" } | { type: "logout" } | null>(null);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? projects[0] ?? null,
    [projects, selectedProjectId],
  );

  function addActivity(label: string) {
    setActivityEvents((events) => [activity(label), ...events].slice(0, 8));
  }

  async function checkAuth() {
    setAuth({ status: "checking" });
    try {
      const response = await getCurrentUser();
      setAuth({ status: "authenticated", user: response.data });
    } catch {
      setAuth({ status: "anonymous" });
      window.history.replaceState(null, "", "/login");
    }
  }

  async function loadProjects() {
    setProjectsStatus("loading");
    setProjectsError(null);
    try {
      const response = await listProjects();
      setProjects(response.data);
      setSelectedProjectId((current) => current ?? response.data[0]?.id ?? null);
      setProjectsStatus("ready");
      addActivity("список проектов загружен");
    } catch (error) {
      setProjectsStatus("error");
      setProjectsError(error instanceof ApiError ? error.message : "API недоступен.");
    }
  }

  async function loadEditor(project: AdminProject | null): Promise<ProjectEditor | null> {
    if (!project) return null;
    setEditorLoading(true);
    try { const response = await getEditor(project.slug); setEditor(response.data); setPreviewContent(response.data.editable.content); return response.data; }
    catch (error) { setProjectsError(error instanceof ApiError ? error.message : "Не удалось загрузить редактор проекта."); return null; }
    finally { setEditorLoading(false); }
  }

  async function refreshSelectedProject(): Promise<ProjectEditor | null> {
    const response = await listProjects();
    setProjects(response.data);
    const refreshed = response.data.find((project) => project.id === selectedProjectId) ?? null;
    return loadEditor(refreshed);
  }

  async function handleProjectDeleted(projectId: string): Promise<void> {
    setEditorDirty(false);
    setEditor(null);
    setPreviewContent(null);
    setProjectsStatus("loading");
    setProjectsError(null);
    try {
      const response = await listProjects();
      const remaining = response.data.filter((project) => project.id !== projectId);
      setProjects(remaining);
      setSelectedProjectId(remaining[0]?.id ?? null);
      setProjectsStatus("ready");
      addActivity("неопубликованный проект удалён");
    } catch (error) {
      setProjectsStatus("error");
      setProjectsError(error instanceof ApiError ? error.message : "Не удалось обновить список проектов.");
    }
  }

  useEffect(() => {
    void checkAuth();
  }, []);

  useEffect(() => {
    if (auth.status === "authenticated") {
      window.history.replaceState(null, "", "/");
      void loadProjects();
    }
  }, [auth.status]);

  useEffect(() => { void loadEditor(selectedProject); }, [selectedProject?.id]);

  async function handleLogin(login: string, password: string) {
    const response = await loginRequest(login, password);
    setAuth({ status: "authenticated", user: response.data });
    addActivity("вход выполнен");
  }

  async function handleLogout() {
    if (editorDirty) { setPendingAction({ type: "logout" }); return; }
    await performLogout();
  }

  async function performLogout() {
    addActivity("начат выход из CMS");
    try {
      await logoutRequest();
    } finally {
      setAuth({ status: "anonymous" });
      setProjects([]);
      setSelectedProjectId(null);
      setEditor(null);
      setEditorDirty(false);
      window.history.replaceState(null, "", "/login");
    }
  }

  function handleProjectSelected(projectId: string) {
    if (projectId === selectedProjectId) return;
    if (editorDirty) { setPendingAction({ type: "switch", projectId }); return; }
    setSelectedProjectId(projectId);
    const project = projects.find((item) => item.id === projectId);
    addActivity(`выбран проект: ${project ? projectDisplayTitle(project) : projectId}`);
  }

  async function createNewProject() {
    try {
      const response = await createProject();
      setEditor(response.data); setPreviewContent(response.data.editable.content); setSelectedProjectId(response.data.project.id); setEditorDirty(false);
      await loadProjects();
      addActivity("создан новый черновик проекта");
    } catch (error) { setProjectsError(error instanceof ApiError ? error.message : "Не удалось создать проект."); }
  }

  function handleCreateProject() {
    if (editorDirty) { setPendingAction({ type: "create" }); return; }
    void createNewProject();
  }

  function discardAndContinue() {
    if (!pendingAction) return;
    if (pendingAction.type === "logout") { setPendingAction(null); void performLogout(); return; }
    if (pendingAction.type === "create") { setEditorDirty(false); setPendingAction(null); void createNewProject(); return; }
    const project = projects.find((item) => item.id === pendingAction.projectId);
    setEditorDirty(false); setSelectedProjectId(pendingAction.projectId); setPendingAction(null);
    addActivity(`выбран проект: ${project ? projectDisplayTitle(project) : pendingAction.projectId}`);
  }

  function handleLocaleChanged(nextLocale: Locale) {
    setLocale(nextLocale);
    addActivity(`язык предпросмотра: ${nextLocale.toUpperCase()}`);
  }

  const handlePreviewChanged = useCallback((content: DraftContent) => {
    setPreviewContent(content);
    setProjects((current) => current.map((project) => {
      if (project.id !== selectedProjectId || project.status !== "draft") return project;
      return {
        ...project,
        translations: {
          ...project.translations,
          values: {
            en: { ...project.translations.values.en, title: content.translations.en.title },
            ru: { ...project.translations.values.ru, title: content.translations.ru.title },
          },
        },
      };
    }));
  }, [selectedProjectId]);

  if (auth.status === "checking") {
    return (
      <main className="auth-check" aria-live="polite">
        <div className="auth-check__mark">M</div>
        <p>Проверка сессии CMS...</p>
      </main>
    );
  }

  if (auth.status === "anonymous") {
    return <LoginScreen onLogin={handleLogin} apiBaseUrl={API_BASE_URL} />;
  }

  return (
    <>
      <CmsShell
      user={auth.user}
      projects={projects}
      projectsStatus={projectsStatus}
      projectsError={projectsError}
      selectedProject={selectedProject}
      editor={editor}
      editorLoading={editorLoading}
      previewContent={previewContent}
      selectedProjectId={selectedProject?.id ?? null}
      locale={locale}
      activityEvents={activityEvents}
      apiBaseUrl={API_BASE_URL}
      onRetryProjects={loadProjects}
      onProjectSelected={handleProjectSelected}
      onCreateProject={handleCreateProject}
      onLocaleChanged={handleLocaleChanged}
      onLogout={handleLogout}
      onEditorSaved={refreshSelectedProject}
      onProjectDeleted={handleProjectDeleted}
      onPreviewChanged={handlePreviewChanged}
      onDirtyChange={setEditorDirty}
      />
      {pendingAction ? <AccessibleDialog
      title={pendingAction.type === "logout" ? "Отменить несохранённые изменения и выйти?" : pendingAction.type === "create" ? "Отменить несохранённые изменения и создать проект?" : `Отменить несохранённые изменения и перейти к «${(() => { const project = projects.find((item) => item.id === pendingAction.projectId); return project ? projectDisplayTitle(project) : "этому проекту"; })()}»?`}
      description="Несохранённые локальные изменения будут отменены. Сохранённые черновики останутся доступными."
      confirmLabel={pendingAction.type === "logout" ? "Отменить изменения и выйти" : pendingAction.type === "create" ? "Отменить изменения и создать" : "Отменить изменения и перейти"}
      cancelLabel="Остаться в редакторе"
      onCancel={() => setPendingAction(null)} onConfirm={discardAndContinue}
      /> : null}
    </>
  );
}
