import type { DraftContent, Locale } from "../api/types";

interface PublishedPreviewProps {
  content: DraftContent | null;
  locale: Locale;
  source?: "draft" | "published";
}

export function PublishedPreview({ content, locale }: PublishedPreviewProps) {
  const heading = "Предпросмотр";
  if (!content) {
    return (
      <section className="published-preview">
        <h2>{heading}</h2>
        <p>Проект не выбран.</p>
      </section>
    );
  }

  const translation = content.translations[locale];
  const mobile = content.media.filter((item) => item.galleryKind === "mobile").sort((a, b) => a.sortOrder - b.sortOrder);
  const desktop = content.media.filter((item) => item.galleryKind === "desktop").sort((a, b) => a.sortOrder - b.sortOrder);
  const links = [...content.links]
    .filter((link) => link.url.trim() && link.label[locale].trim())
    .sort((first, second) => first.sortOrder - second.sortOrder);

  return (
    <section className="published-preview" aria-labelledby="preview-title">
      <div className="preview-toolbar">
        <div>
          <h2 id="preview-title">{heading}</h2>
          <p>Представление содержимого в CMS</p>
        </div>
        <div className="viewport-switch" aria-label="Preview viewport controls">
          <button type="button" className="is-active">
            Десктоп
          </button>
          <button type="button">Планшет</button>
          <button type="button">Мобильный</button>
        </div>
      </div>

      <article className="preview-card">
        {translation.displayType ? <p className="preview-card__type">{translation.displayType}</p> : null}
        <p className="preview-card__status">{translation.statusLabel}</p>
        <h3>{translation.title}</h3>
        <p>{translation.role}</p>
        <p>{translation.description}</p>
        {content.features.filter((item) => item.text[locale]).length ? <ul className="preview-card__features">{content.features.filter((item) => item.text[locale]).sort((a, b) => a.sortOrder - b.sortOrder).map((item) => <li key={item.id}>{item.text[locale]}</li>)}</ul> : null}
        <div className="preview-card__tags">
          {content.technologies.slice(0, 6).map((technology) => (
            <span key={technology.slug}>{technology.name}</span>
          ))}
        </div>
        {content.notes.filter((item) => item.text[locale]).length ? <div className="preview-card__notes">{content.notes.filter((item) => item.text[locale]).sort((a, b) => a.sortOrder - b.sortOrder).map((item) => <p className="project-card__note" key={item.id}>{item.text[locale]}</p>)}</div> : null}
        {links.length ? <div className="preview-card__links">{links.map((link) => <a key={link.id} href={link.url}>{link.label[locale]}</a>)}</div> : null}
        {([ ["Мобильные изображения", mobile], ["Десктопные изображения", desktop] ] as const).map(([heading, media]) => media.length ? <section className="preview-media-group" key={heading}><h4>{heading}</h4><div className="preview-media-grid">{media.map((item) => <figure key={item.id}><img className={item.presentation === "contain" ? "preview-media-grid__image preview-media-grid__image--contain" : "preview-media-grid__image"} src={item.sourceType === "managed" ? `/api/v1/media/${item.assetId}/thumbnail` : `/${item.src}`} alt={item.translations[locale]?.alt ?? ""} /><figcaption>{item.translations[locale]?.ariaLabel}</figcaption></figure>)}</div></section> : null)}
      </article>
    </section>
  );
}
