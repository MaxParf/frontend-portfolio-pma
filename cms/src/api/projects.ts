import { apiFetch } from "./client";
import type { AdminProject, DraftContent, MediaOrientation, ProjectEditor, ProjectRevision, UploadedMedia } from "./types";

export function listProjects(): Promise<{ data: AdminProject[]; meta: { count: number } }> {
  return apiFetch("/api/v1/admin/projects");
}

export function getEditor(slug: string): Promise<{ data: ProjectEditor }> { return apiFetch(`/api/v1/admin/projects/${encodeURIComponent(slug)}/editor`); }
export function saveDraft(slug: string, body: { baseRevisionId: string; expectedDraftRevisionId: string | null; content: DraftContent }): Promise<{ data: { revisionId: string; revisionNumber: number; updatedAt: string } }> { return apiFetch(`/api/v1/admin/projects/${encodeURIComponent(slug)}/draft`, { method: "PUT", body: JSON.stringify(body) }); }
export function publishDraft(slug: string, expectedDraftRevisionId: string): Promise<{ data: { revisionId: string; revisionNumber: number; publishedAt: string } }> { return apiFetch(`/api/v1/admin/projects/${encodeURIComponent(slug)}/publish`, { method: "POST", body: JSON.stringify({ expectedDraftRevisionId, confirmation: true }) }); }
export function listRevisions(slug: string): Promise<{ data: ProjectRevision[] }> { return apiFetch(`/api/v1/admin/projects/${encodeURIComponent(slug)}/revisions`); }
export function uploadMedia(slug: string, file: File, orientation: MediaOrientation, confirmOrientationMismatch = false): Promise<{ data: UploadedMedia }> { const body = new FormData(); body.append("orientation", orientation); if (confirmOrientationMismatch) body.append("confirmOrientationMismatch", "true"); body.append("file", file); return apiFetch(`/api/v1/admin/projects/${encodeURIComponent(slug)}/media`, { method: "POST", body }); }
