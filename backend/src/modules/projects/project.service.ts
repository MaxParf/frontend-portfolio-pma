import { HttpError } from "../../middleware/error-handler.js";
import { mapProjectToPublicDto } from "./project.mapper.js";
import type { ProjectRepository } from "./project.repository.js";
import { localeSchema, type Locale } from "./project.schemas.js";

type ProjectReader = Pick<ProjectRepository, "findPublished" | "findPublishedBySlug">;

export class ProjectService {
  constructor(private readonly repository: ProjectReader) {}

  parseLocale(input: unknown): Locale {
    return localeSchema.parse(input ?? "en");
  }

  async list(localeInput: unknown) {
    const locale = this.parseLocale(localeInput);
    const projects = await this.repository.findPublished(locale);
    return {
      data: projects.map(mapProjectToPublicDto),
      meta: {
        locale,
        count: projects.length,
      },
    };
  }

  async getBySlug(slug: string, localeInput: unknown) {
    const locale = this.parseLocale(localeInput);
    const project = await this.repository.findPublishedBySlug(slug, locale);

    if (!project) {
      throw new HttpError(404, "NOT_FOUND", "Project not found.");
    }

    return {
      data: mapProjectToPublicDto(project),
      meta: {
        locale,
      },
    };
  }
}
