import { useEffect, useMemo, useState } from "react";
import { getCurrentUser, login as loginRequest, logout as logoutRequest } from "../api/auth";
import { ApiError, API_BASE_URL } from "../api/client";
import { listProjects } from "../api/projects";
import type { AdminProject, AdminUser, Locale } from "../api/types";
import { LoginScreen } from "./LoginScreen";
import { CmsShell } from "./CmsShell";

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
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);

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

  useEffect(() => {
    void checkAuth();
  }, []);

  useEffect(() => {
    if (auth.status === "authenticated") {
      window.history.replaceState(null, "", "/");
      void loadProjects();
    }
  }, [auth.status]);

  async function handleLogin(login: string, password: string) {
    const response = await loginRequest(login, password);
    setAuth({ status: "authenticated", user: response.data });
    addActivity("login successful");
  }

  async function handleLogout() {
    addActivity("logout initiated");
    try {
      await logoutRequest();
    } finally {
      setAuth({ status: "anonymous" });
      setProjects([]);
      setSelectedProjectId(null);
      window.history.replaceState(null, "", "/login");
    }
  }

  function handleProjectSelected(projectId: string) {
    setSelectedProjectId(projectId);
    const project = projects.find((item) => item.id === projectId);
    addActivity(`project selected: ${project?.translations.en.title ?? projectId}`);
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
    <CmsShell
      user={auth.user}
      projects={projects}
      projectsStatus={projectsStatus}
      projectsError={projectsError}
      selectedProject={selectedProject}
      selectedProjectId={selectedProject?.id ?? null}
      locale={locale}
      activityEvents={activityEvents}
      apiBaseUrl={API_BASE_URL}
      onRetryProjects={loadProjects}
      onProjectSelected={handleProjectSelected}
      onLocaleChanged={handleLocaleChanged}
      onLogout={handleLogout}
    />
  );
}
