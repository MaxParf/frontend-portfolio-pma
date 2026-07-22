import { useEffect, useMemo, useState } from "react";
import { getCurrentUser, login as loginRequest, logout as logoutRequest } from "../api/auth";
import { ApiError, API_BASE_URL } from "../api/client";
import { getEditor, listProjects } from "../api/projects";
import type { AdminProject, AdminUser, DraftContent, Locale, ProjectEditor } from "../api/types";
import { LoginScreen } from "./LoginScreen";
import { CmsShell } from "./CmsShell";
import { AccessibleDialog } from "./AccessibleDialog";

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
  const [pendingAction, setPendingAction] = useState<{ type: "switch"; projectId: string } | { type: "logout" } | null>(null);

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
      addActivity("project list loaded");
    } catch (error) {
      setProjectsStatus("error");
      setProjectsError(error instanceof ApiError ? error.message : "API unavailable.");
    }
  }

  async function loadEditor(project: AdminProject | null): Promise<ProjectEditor | null> {
    if (!project) return null;
    setEditorLoading(true);
    try { const response = await getEditor(project.slug); setEditor(response.data); setPreviewContent(response.data.draft?.content ?? response.data.published.content); return response.data; }
    catch (error) { setProjectsError(error instanceof ApiError ? error.message : "Unable to load project editor."); return null; }
    finally { setEditorLoading(false); }
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
    addActivity("login successful");
  }

  async function handleLogout() {
    if (editorDirty) { setPendingAction({ type: "logout" }); return; }
    await performLogout();
  }

  async function performLogout() {
    addActivity("logout initiated");
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
    addActivity(`project selected: ${project?.translations.en.title ?? projectId}`);
  }

  function discardAndContinue() {
    if (!pendingAction) return;
    if (pendingAction.type === "logout") { setPendingAction(null); void performLogout(); return; }
    const project = projects.find((item) => item.id === pendingAction.projectId);
    setEditorDirty(false); setSelectedProjectId(pendingAction.projectId); setPendingAction(null);
    addActivity(`project selected: ${project?.translations.en.title ?? pendingAction.projectId}`);
  }

  function handleLocaleChanged(nextLocale: Locale) {
    setLocale(nextLocale);
    addActivity(`locale switched: ${nextLocale.toUpperCase()}`);
  }

  if (auth.status === "checking") {
    return (
      <main className="auth-check" aria-live="polite">
        <div className="auth-check__mark">M</div>
        <p>Checking CMS session...</p>
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
      onLocaleChanged={handleLocaleChanged}
      onLogout={handleLogout}
      onEditorSaved={() => loadEditor(selectedProject)}
      onPreviewChanged={setPreviewContent}
      onDirtyChange={setEditorDirty}
      />
      {pendingAction ? <AccessibleDialog
      title={pendingAction.type === "logout" ? "Discard unsaved changes and log out?" : `Discard unsaved changes and switch to “${projects.find((item) => item.id === pendingAction.projectId)?.translations.en.title ?? "this project"}”?`}
      description={pendingAction.type === "logout" ? "Your local unsaved changes will be discarded. Saved drafts remain available." : `You have unsaved changes in “${selectedProject?.translations.en.title ?? "the current project"}”. Saved drafts remain available.`}
      confirmLabel={pendingAction.type === "logout" ? "Discard changes and log out" : "Discard changes and switch"}
      cancelLabel={pendingAction.type === "logout" ? "Stay" : "Stay and continue editing"}
      onCancel={() => setPendingAction(null)} onConfirm={discardAndContinue}
      /> : null}
    </>
  );
}
