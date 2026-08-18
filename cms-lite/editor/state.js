import { createEmptyProject } from "../../project-core/project-model.js";
import { normalizeProjectState } from "../../project-core/project-normalizer.js";
import { validateProjectState } from "../../project-core/project-validator.js";

const clone = (value) => structuredClone(value);

export function createMemoryStorage(initialState) {
  let saved = normalizeProjectState(initialState);
  return {
    async load() { return clone(saved); },
    async save(state) { saved = normalizeProjectState(state); return clone(saved); },
  };
}

export function createEditorState({ initialState, storage }) {
  let serverState = normalizeProjectState(initialState);
  let workingState = clone(serverState);
  let selectedProjectId = workingState.projects[0]?.id ?? null;
  const pendingMedia = new Map();
  let pendingMediaDirty = false;

  const snapshot = () => ({
    serverState: clone(serverState), workingState: clone(workingState), baseVersion: serverState.version,
    selectedProjectId, dirty: JSON.stringify(normalizeProjectState(workingState)) !== JSON.stringify(serverState) || pendingMediaDirty,
    pendingMedia: new Map([...pendingMedia].map(([id, media]) => [id, clone(media)])),
  });

  return {
    async load() {
      serverState = normalizeProjectState(await storage.load());
      workingState = clone(serverState);
      selectedProjectId = workingState.projects[0]?.id ?? null;
      return snapshot();
    },
    snapshot,
    select(projectId) { selectedProjectId = workingState.projects.some((project) => project.id === projectId) ? projectId : null; return snapshot(); },
    update(mutator) { const next = clone(workingState); mutator(next); workingState = normalizeProjectState(next); return snapshot(); },
    createProject(id) {
      const next = clone(workingState);
      next.projects.push({ ...createEmptyProject(id), order: (Math.max(0, ...next.projects.map((project) => project.order)) + 10) });
      workingState = normalizeProjectState(next);
      selectedProjectId = id;
      return snapshot();
    },
    deleteProject(id) {
      const next = clone(workingState);
      next.projects = next.projects.filter((project) => project.id !== id);
      workingState = normalizeProjectState(next);
      if (selectedProjectId === id) selectedProjectId = workingState.projects[0]?.id ?? null;
      return snapshot();
    },
    setPendingMedia(media) { pendingMedia.set(media.id, clone(media)); pendingMediaDirty = true; return snapshot(); },
    updatePendingMedia(mediaId, mutate) { const media = pendingMedia.get(mediaId); if (!media) return snapshot(); const next = clone(media); mutate(next); pendingMedia.set(mediaId, next); pendingMediaDirty = true; return snapshot(); },
    clearPendingMedia(mediaId) { pendingMedia.delete(mediaId); pendingMediaDirty = true; return snapshot(); },
    async save() {
      const validation = validateProjectState(workingState);
      if (!validation.valid) return { saved: false, validation, snapshot: snapshot() };
      serverState = normalizeProjectState(await storage.save(workingState, [...pendingMedia.values()].map(clone)));
      workingState = clone(serverState);
      if (storage.clearsPendingMedia) pendingMedia.clear();
      pendingMediaDirty = false;
      return { saved: true, validation, snapshot: snapshot() };
    },
  };
}
