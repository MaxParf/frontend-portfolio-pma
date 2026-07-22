import type { ActivityEvent } from "./App";
import type { AdminProject, AdminUser, Locale } from "../api/types";
import { DesktopGate } from "./DesktopGate";
import { ProjectTree } from "./ProjectTree";
import { ProjectInspector } from "./ProjectInspector";
import { PublishedPreview } from "./PublishedPreview";
import { ActivityPanel } from "./ActivityPanel";

interface CmsShellProps {
  user: AdminUser;
  projects: AdminProject[];
  projectsStatus: "idle" | "loading" | "ready" | "error";
  projectsError: string | null;
  selectedProject: AdminProject | null;
  selectedProjectId: string | null;
  locale: Locale;
  activityEvents: ActivityEvent[];
  apiBaseUrl: string;
  onRetryProjects: () => void;
  onProjectSelected: (projectId: string) => void;
  onLocaleChanged: (locale: Locale) => void;
  onLogout: () => void;
}

export function CmsShell(props: CmsShellProps) {
  return (
    <>
      <DesktopGate onLogout={props.onLogout} />
      <div className="cms-shell" data-testid="cms-shell">
        <header className="topbar">
          <div className="topbar__brand-group">
            <strong className="brand">Maxpar CMS</strong>
            <span className="environment">
              <span className="environment__dot" aria-hidden="true" />
              Local
            </span>
            <span className="api-status" aria-live="polite">
              API online: {props.apiBaseUrl}
            </span>
          </div>
          <div className="topbar__actions">
            <div className="language-switch" aria-label="Preview locale">
              <button type="button" className={props.locale === "en" ? "is-active" : ""} onClick={() => props.onLocaleChanged("en")}>
                EN
              </button>
              <button type="button" className={props.locale === "ru" ? "is-active" : ""} onClick={() => props.onLocaleChanged("ru")}>
                RU
              </button>
            </div>
            <span className="user-pill">{props.user.displayName}</span>
            <button className="logout-button" type="button" onClick={props.onLogout}>
              Logout
            </button>
          </div>
        </header>

        <main className="workspace">
          <ProjectTree
            projects={props.projects}
            status={props.projectsStatus}
            error={props.projectsError}
            selectedProjectId={props.selectedProjectId}
            onRetry={props.onRetryProjects}
            onProjectSelected={props.onProjectSelected}
          />
          <ProjectInspector project={props.selectedProject} locale={props.locale} status={props.projectsStatus} />
          <aside className="preview-panel" aria-label="Published preview">
            <PublishedPreview project={props.selectedProject} locale={props.locale} />
            <ActivityPanel events={props.activityEvents} />
          </aside>
        </main>
      </div>
    </>
  );
}
