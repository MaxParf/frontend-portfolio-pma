import type { AdminProject } from "../api/types";

/**
 * The only display-title policy for the CMS project tree.
 * Missing translations are valid exclusively for an untouched draft.
 */
export function projectDisplayTitle(project: AdminProject): string {
  if (project.translations.status !== "draft") return project.translations.values.en.title;

  const title = project.translations.values.ru?.title?.trim() || project.translations.values.en?.title?.trim();
  return title || "Новый проект";
}
