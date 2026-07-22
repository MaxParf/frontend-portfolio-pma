import type { AdminProject, Locale } from "../api/types";

interface PublishedPreviewProps {
  project: AdminProject | null;
  locale: Locale;
}

export function PublishedPreview({ project, locale }: PublishedPreviewProps) {
  if (!project) {
    return (
      <section className="published-preview">
        <h2>Published data preview</h2>
        <p>No project selected.</p>
      </section>
    );
  }

  const translation = project.translations[locale];
  const media = project.media[0];

  return (
    <section className="published-preview" aria-labelledby="preview-title">
      <div className="preview-toolbar">
        <div>
          <h2 id="preview-title">Published data preview</h2>
          <p>Locale: {locale.toUpperCase()}</p>
        </div>
        <div className="viewport-switch" aria-label="Preview viewport controls">
          <button type="button" className="is-active">
            Desktop
          </button>
          <button type="button">Tablet</button>
          <button type="button">Mobile</button>
        </div>
      </div>

      <article className="preview-card">
        <p className="preview-card__status">{translation.statusLabel}</p>
        <h3>{translation.title}</h3>
        <p>{translation.description}</p>
        <div className="preview-card__tags">
          {project.technologies.slice(0, 6).map((technology) => (
            <span key={technology}>{technology}</span>
          ))}
        </div>
        {media ? (
          <figure>
            <img src={`/${media.src}`} alt={media.translations[locale]?.alt ?? ""} />
            <figcaption>{media.translations[locale]?.ariaLabel}</figcaption>
          </figure>
        ) : null}
      </article>
    </section>
  );
}
