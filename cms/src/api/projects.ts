import { apiFetch } from "./client";
import { ApiContractError } from "./client";
import { adminProjectEditorEnvelopeSchema, adminProjectListResponseSchema, adminProjectRevisionsEnvelopeSchema, type SaveProjectRequest } from "../../../contracts/project-contracts";
import type { AdminProject, DraftContent, MediaOrientation, ProjectEditor, ProjectRevision, UploadedMedia } from "./types";

export function listProjects(): Promise<{ data: AdminProject[]; meta: { count: number } }> {
  return parseResponse(apiFetch("/api/v1/admin/projects"), adminProjectListResponseSchema);
}
export function createProject(): Promise<{ data: ProjectEditor }> { return parseResponse(apiFetch("/api/v1/admin/projects", { method: "POST" }), adminProjectEditorEnvelopeSchema); }

export function getEditor(slug: string): Promise<{ data: ProjectEditor }> { return parseResponse(apiFetch(`/api/v1/admin/projects/${encodeURIComponent(slug)}/editor`), adminProjectEditorEnvelopeSchema); }
export function getPublished(slug: string): Promise<{ data: ProjectEditor }> { return parseResponse(apiFetch(`/api/v1/admin/projects/${encodeURIComponent(slug)}/published`), adminProjectEditorEnvelopeSchema); }
export function createDraftFromPublished(slug: string): Promise<{ data: ProjectEditor }> { return parseResponse(apiFetch(`/api/v1/admin/projects/${encodeURIComponent(slug)}/draft/from-published`, { method: "POST" }), adminProjectEditorEnvelopeSchema); }
export function saveDraft(slug: string, body: SaveProjectRequest): Promise<{ data: { revisionId: string; revisionNumber: number; updatedAt: string } }> { return apiFetch(`/api/v1/admin/projects/${encodeURIComponent(slug)}/draft`, { method: "PUT", body: JSON.stringify(body) }); }
export function deleteDraft(slug: string, expectedDraftRevisionId: string): Promise<void> { return apiFetch(`/api/v1/admin/projects/${encodeURIComponent(slug)}/draft`, { method: "DELETE", body: JSON.stringify({ expectedDraftRevisionId }) }); }
export function deleteProject(slug: string): Promise<void> { return apiFetch(`/api/v1/admin/projects/${encodeURIComponent(slug)}`, { method: "DELETE" }); }
export function publishDraft(slug: string, expectedDraftRevisionId: string): Promise<{ data: { revisionId: string; revisionNumber: number; publishedAt: string } }> { return apiFetch(`/api/v1/admin/projects/${encodeURIComponent(slug)}/publish`, { method: "POST", body: JSON.stringify({ expectedDraftRevisionId, confirmation: true }) }); }
export function listRevisions(slug: string): Promise<{ data: ProjectRevision[] }> { return parseResponse(apiFetch(`/api/v1/admin/projects/${encodeURIComponent(slug)}/revisions`), adminProjectRevisionsEnvelopeSchema); }
export function uploadMedia(slug: string, file: File, orientation: MediaOrientation, confirmOrientationMismatch = false): Promise<{ data: UploadedMedia }> { const body = new FormData(); body.append("orientation", orientation); if (confirmOrientationMismatch) body.append("confirmOrientationMismatch", "true"); body.append("file", file); return apiFetch(`/api/v1/admin/projects/${encodeURIComponent(slug)}/media`, { method: "POST", body }); }

async function parseResponse<T>(request: Promise<unknown>, schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } }): Promise<T> {
  const parsed = schema.safeParse(await request);
  if (!parsed.success) throw new ApiContractError();
  return parsed.data;
}
