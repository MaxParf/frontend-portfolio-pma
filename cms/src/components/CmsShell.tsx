import type { ActivityEvent } from "./App";
import type { AdminProject, AdminUser, DraftContent, Locale, ProjectEditor } from "../api/types";
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
  editor?: ProjectEditor | null;
  editorLoading?: boolean;
  previewContent?: DraftContent | null;
  selectedProjectId: string | null;
  locale: Locale;
  activityEvents: ActivityEvent[];
  apiBaseUrl: string;
  onRetryProjects: () => void;
  onProjectSelected: (projectId: string) => void;
  onLocaleChanged: (locale: Locale) => void;
  onLogout: () => void;
  onEditorSaved?: () => Promise<ProjectEditor | null>;
  onPreviewChanged?: (content: DraftContent) => void;
  onDirtyChange?: (dirty: boolean) => void;
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
            <span className="user-pill">
              {props.user.login}
              <span>Owner</span>
            </span>
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
          <ProjectInspector editor={props.editor ?? null} locale={props.locale} loading={props.editorLoading ?? false} onSaved={props.onEditorSaved ?? (async () => null)} onPreview={props.onPreviewChanged ?? (() => undefined)} onDirtyChange={props.onDirtyChange ?? (() => undefined)} />
          <aside className="preview-panel" aria-label="Draft preview">
            <PublishedPreview content={props.previewContent ?? null} locale={props.locale} />
            <ActivityPanel events={props.activityEvents} />
          </aside>
        </main>
      </div>
    </>
  );
}
