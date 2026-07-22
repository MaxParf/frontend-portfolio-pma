import type { AdminProject } from "../api/types";

interface ProjectTreeProps {
  projects: AdminProject[];
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  selectedProjectId: string | null;
  onRetry: () => void;
  onProjectSelected: (projectId: string) => void;
}

const inactiveSections = ["About", "Technologies", "Contacts", "Media", "SEO", "System"];

export function ProjectTree({ projects, status, error, selectedProjectId, onRetry, onProjectSelected }: ProjectTreeProps) {
  return (
    <aside className="site-tree" aria-label="CMS content tree">
      <div className="panel-heading">
        <h1>Portfolio</h1>
        <span className="phase-badge">Phase 3A</span>
      </div>

      <nav className="tree" aria-label="Portfolio structure">
        <button className="tree-row tree-row--root" type="button">
          Overview
        </button>
        <div className="tree-row tree-row--section" aria-expanded="true">
          <span>Projects</span>
          <span className="count-badge">{projects.length}</span>
        </div>

        {status === "loading" ? <p className="tree-state">Project list loading...</p> : null}
        {status === "error" ? (
          <div className="tree-state tree-state--error">
            <p>{error ?? "API unavailable."}</p>
            <button type="button" onClick={onRetry}>
              Retry
            </button>
          </div>
        ) : null}

        <div className="tree-projects">
          {projects.map((project) => (
            <button
              type="button"
              key={project.id}
              className={`project-row ${project.id === selectedProjectId ? "project-row--selected" : ""}`}
              aria-current={project.id === selectedProjectId ? "page" : undefined}
              onClick={() => onProjectSelected(project.id)}
            >
              <span className="project-row__label">{project.translations.en.title}</span>
              <span className="status status--published">Published</span>
            </button>
          ))}
        </div>

        {inactiveSections.map((section) => (
          <button className="tree-row tree-row--disabled" type="button" key={section} aria-disabled="true">
            <span>{section}</span>
            <small>Not available in this phase</small>
          </button>
        ))}
      </nav>
    </aside>
  );
}
