import { apiFetch } from "./client";
import type { AdminProject } from "./types";

export function listProjects(): Promise<{ data: AdminProject[]; meta: { count: number } }> {
  return apiFetch("/api/v1/admin/projects");
}
