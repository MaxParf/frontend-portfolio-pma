import type { DraftContent, Locale } from "../api/types";

interface PublishedPreviewProps {
  content: DraftContent | null;
  locale: Locale;
}

export function PublishedPreview({ content, locale }: PublishedPreviewProps) {
  if (!content) {
    return (
      <section className="published-preview">
        <h2>Draft preview</h2>
        <p>No project selected.</p>
      </section>
    );
  }

  const translation = content.translations[locale];
  const media = content.media[0];

  return (
    <section className="published-preview" aria-labelledby="preview-title">
      <div className="preview-toolbar">
        <div>
          <h2 id="preview-title">Draft preview</h2>
          <p>Content preview - CMS representation</p>
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
          {content.technologies.slice(0, 6).map((technology) => (
            <span key={technology.slug}>{technology.name}</span>
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
