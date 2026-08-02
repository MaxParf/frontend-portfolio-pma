import type { AdminProject } from "../api/types";
import { projectDisplayTitle } from "./project-display-title";

interface ProjectTreeProps {
  projects: AdminProject[];
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  selectedProjectId: string | null;
  onRetry: () => void;
  onProjectSelected: (projectId: string) => void;
  onCreateProject: () => void;
}

const inactiveSections = ["About", "Technologies", "Contacts", "Media", "System"];

export function ProjectTree({ projects, status, error, selectedProjectId, onRetry, onProjectSelected, onCreateProject }: ProjectTreeProps) {
  return (
    <aside className="site-tree" aria-label="Дерево содержимого CMS">
      <div className="panel-heading">
        <h1>Портфолио</h1>
            <span className="phase-badge">Локальная CMS</span>
      </div>

      <nav className="tree" aria-label="Структура портфолио">
        <div className="tree-create"><button type="button" onClick={onCreateProject}>Создать проект</button></div>
        <button className="tree-row tree-row--root" type="button">
          Обзор
        </button>
        <div className="tree-row tree-row--section" aria-expanded="true">
          <span>Проекты</span>
          <span className="count-badge">{projects.length}</span>
        </div>

        {status === "loading" ? <p className="tree-state">Загрузка списка проектов...</p> : null}
        {status === "error" ? (
          <div className="tree-state tree-state--error">
            <p>{error ?? "API недоступен."}</p>
            <button type="button" onClick={onRetry}>
              Повторить
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
              <span className="project-row__label">{projectDisplayTitle(project)}</span>
              <span className="status status--published">{project.status === "published" ? "Опубликован" : project.status === "draft" ? "Черновик" : project.status}</span>
            </button>
          ))}
        </div>

        {inactiveSections.map((section) => (
          <button className="tree-row tree-row--disabled" type="button" key={section} aria-disabled="true">
            <span>{section}</span>
            <small>Недоступно на этом этапе</small>
          </button>
        ))}
      </nav>
    </aside>
  );
}
