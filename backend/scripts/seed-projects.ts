import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import pg from "pg";
import { loadEnv } from "../src/config/env.js";
import { frontendProjectsSchema, type FrontendProject } from "../src/modules/projects/project.schemas.js";

type Locale = "en" | "ru";

export interface SeedResult {
  projects: number;
  technologies: number;
  media: number;
}

function deterministicUuid(key: string): string {
  const hash = createHash("sha1").update(`maxpar-portfolio:${key}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function technologySlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeDescription(description: string | string[]): string {
  return Array.isArray(description) ? description.join("\n\n") : description;
}

function firstLink(project: FrontendProject, index: number) {
  return project.links[index] ?? null;
}

export async function loadFrontendProjects(): Promise<FrontendProject[]> {
  const projectsModuleUrl = pathToFileURL(fileURLToPath(new URL("../../data/projects.js", import.meta.url))).href;
  const module = (await import(projectsModuleUrl)) as { projects?: unknown };
  return frontendProjectsSchema.parse(module.projects);
}

export async function seedProjects(pool: pg.Pool, sourceProjects: FrontendProject[]): Promise<SeedResult> {
  const client = await pool.connect();

  try {
    await client.query("begin");

    const uniqueTechnologies = [...new Set(sourceProjects.flatMap((project) => project.technologies))];
    const technologyIds = new Map<string, string>();

    for (const [index, technology] of uniqueTechnologies.entries()) {
      const id = deterministicUuid(`technology:${technologySlug(technology)}`);
      technologyIds.set(technology, id);
      await client.query(
        `
          insert into technologies (id, slug, name, sort_order, is_active, created_at, updated_at)
          values ($1, $2, $3, $4, true, now(), now())
          on conflict (slug) do update set
            name = excluded.name,
            sort_order = excluded.sort_order,
            is_active = excluded.is_active,
            updated_at = now()
        `,
        [id, technologySlug(technology), technology, (index + 1) * 10],
      );
    }

    for (const project of sourceProjects) {
      const projectId = deterministicUuid(`project:${project.id}`);
      const primary = firstLink(project, 0);
      const secondary = firstLink(project, 1);

      await client.query(
        `
          insert into projects (
            id, external_key, slug, gallery_id, status, sort_order, project_type,
            started_at, ended_at, is_ongoing, primary_url, primary_link_type,
            secondary_url, secondary_link_type, created_at, updated_at, published_at
          )
          values ($1, $2, $3, $4, $5::project_status, $6, $7, $8, $9, $10, $11, $12, $13, $14, now(), now(), case when $5::project_status = 'published' then now() else null end)
          on conflict (external_key) do update set
            slug = excluded.slug,
            gallery_id = excluded.gallery_id,
            status = excluded.status,
            sort_order = excluded.sort_order,
            project_type = excluded.project_type,
            started_at = excluded.started_at,
            ended_at = excluded.ended_at,
            is_ongoing = excluded.is_ongoing,
            primary_url = excluded.primary_url,
            primary_link_type = excluded.primary_link_type,
            secondary_url = excluded.secondary_url,
            secondary_link_type = excluded.secondary_link_type,
            updated_at = now(),
            published_at = case when excluded.status = 'published' then coalesce(projects.published_at, now()) else null end
        `,
        [
          projectId,
          project.id,
          project.slug,
          project.galleryId,
          project.status,
          project.sortOrder,
          project.meta.type ?? null,
          project.meta.startedAt ?? null,
          project.meta.endedAt ?? null,
          project.meta.ongoing,
          primary?.href ?? null,
          primary?.type ?? null,
          secondary?.href ?? null,
          secondary?.type ?? null,
        ],
      );

      for (const locale of ["en", "ru"] satisfies Locale[]) {
        const translation = project.translations[locale];
        await client.query(
          `
            insert into project_translations (
              id, project_id, locale, title, subtitle, description, role, status_label,
              primary_action_label, secondary_action_label, technologies_title, created_at, updated_at
            )
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), now())
            on conflict (project_id, locale) do update set
              title = excluded.title,
              subtitle = excluded.subtitle,
              description = excluded.description,
              role = excluded.role,
              status_label = excluded.status_label,
              primary_action_label = excluded.primary_action_label,
              secondary_action_label = excluded.secondary_action_label,
              technologies_title = excluded.technologies_title,
              updated_at = now()
          `,
          [
            deterministicUuid(`project-translation:${project.id}:${locale}`),
            projectId,
            locale,
            translation.title,
            translation.subtitle ?? null,
            normalizeDescription(translation.description),
            translation.role,
            translation.statusLabel,
            primary ? (translation.links[primary.id] ?? null) : null,
            secondary ? (translation.links[secondary.id] ?? null) : null,
            translation.technologiesAriaLabel ?? null,
          ],
        );
      }

      await client.query("delete from project_technologies where project_id = $1", [projectId]);
      for (const [index, technology] of project.technologies.entries()) {
        await client.query(
          "insert into project_technologies (project_id, technology_id, sort_order) values ($1, $2, $3)",
          [projectId, technologyIds.get(technology), (index + 1) * 10],
        );
      }

      await client.query("delete from project_media where project_id = $1", [projectId]);
      for (const asset of project.media) {
        const mediaExternalKey = `${project.id}:${asset.id}`;
        const mediaId = deterministicUuid(`media:${mediaExternalKey}`);
        await client.query(
          `
            insert into media_assets (id, external_key, path, role, sort_order, created_at, updated_at)
            values ($1, $2, $3, $4, $5, now(), now())
            on conflict (external_key) do update set
              path = excluded.path,
              role = excluded.role,
              sort_order = excluded.sort_order,
              updated_at = now()
          `,
          [mediaId, mediaExternalKey, asset.src, asset.role, asset.sortOrder],
        );

        for (const locale of ["en", "ru"] satisfies Locale[]) {
          await client.query(
            `
              insert into media_asset_translations (media_asset_id, locale, alt_text, aria_label, created_at, updated_at)
              values ($1, $2, $3, $4, now(), now())
              on conflict (media_asset_id, locale) do update set
                alt_text = excluded.alt_text,
                aria_label = excluded.aria_label,
                updated_at = now()
            `,
            [mediaId, locale, asset.translations[locale].alt, asset.translations[locale].ariaLabel],
          );
        }

        await client.query("insert into project_media (project_id, media_asset_id, sort_order) values ($1, $2, $3)", [
          projectId,
          mediaId,
          asset.sortOrder,
        ]);
      }
    }

    await client.query("commit");
    return {
      projects: sourceProjects.length,
      technologies: uniqueTechnologies.length,
      media: sourceProjects.reduce((count, project) => count + project.media.length, 0),
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const env = loadEnv();
  const pool = new pg.Pool({ connectionString: env.DATABASE_URL });

  try {
    const sourceProjects = await loadFrontendProjects();
    const result = await seedProjects(pool, sourceProjects);
    console.info({ event: "seed_complete", ...result });
  } finally {
    await pool.end();
  }
}
