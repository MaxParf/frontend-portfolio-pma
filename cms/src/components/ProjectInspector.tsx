import type { AdminProject, Locale } from "../api/types";

interface ProjectInspectorProps {
  project: AdminProject | null;
  locale: Locale;
  status: "idle" | "loading" | "ready" | "error";
}

function readonlyField(label: string, value: string | number | null | undefined) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value ?? ""} readOnly aria-label={`${label} Read only`} />
    </label>
  );
}

export function ProjectInspector({ project, locale, status }: ProjectInspectorProps) {
  if (status === "loading") {
    return <section className="editor editor-state">Loading project data...</section>;
  }

  if (!project) {
    return (
      <section className="editor editor-state">
        <h2>No project selected</h2>
        <p>Select a published project from the tree.</p>
      </section>
    );
  }

  const translation = project.translations[locale];

  return (
    <section className="editor" aria-labelledby="editor-title">
      <div className="editor__header">
        <div>
          <h1 id="editor-title">{translation.title}</h1>
          <p>{project.slug}</p>
        </div>
        <span className="readonly-badge">Read only</span>
      </div>

      <div className="tabs" role="tablist" aria-label="Project editor sections">
        {["Content", "Media", "Publishing", "SEO", "History"].map((tab, index) => (
          <button key={tab} type="button" role="tab" aria-selected={index === 0} className={index === 0 ? "tabs__item tabs__item--active" : "tabs__item"}>
            {tab}
          </button>
        ))}
      </div>

      <div className="editor-form">
        <fieldset className="form-section">
          <legend>Project identity</legend>
          <div className="form-grid">
            {readonlyField("Title", translation.title)}
            {readonlyField("Slug", project.slug)}
            {readonlyField("Status", project.status)}
            {readonlyField("Sort order", project.sortOrder)}
            {readonlyField("Gallery ID", project.galleryId)}
            {readonlyField("Type", project.type)}
          </div>
        </fieldset>

        <fieldset className="form-section">
          <legend>Localized content {locale.toUpperCase()}</legend>
          <label className="field">
            <span>Description Read only</span>
            <textarea value={translation.description} readOnly rows={8} />
          </label>
          <label className="field">
            <span>Role Read only</span>
            <textarea value={translation.role} readOnly rows={3} />
          </label>
        </fieldset>

        <fieldset className="form-section">
          <legend>Relations</legend>
          <div className="tags-input" aria-label="Technologies Read only">
            {project.technologies.map((technology) => (
              <span className="tag" key={technology}>
                {technology}
              </span>
            ))}
          </div>
          <div className="form-grid">
            {readonlyField("Primary link", project.links.primary?.href)}
            {readonlyField("Secondary link", project.links.secondary?.href)}
            {readonlyField("Media count", project.media.length)}
            {readonlyField("Published at", project.publishedAt)}
            {readonlyField("Created at", project.createdAt)}
            {readonlyField("Updated at", project.updatedAt)}
          </div>
        </fieldset>
      </div>
    </section>
  );
}
