import { normalizeProjectState } from "../../../project-core/project-normalizer.js";
import { resetDemoSandbox } from "./reset-state.js";

const clone = (value) => structuredClone(value);
const get = (db, store, key) => new Promise((resolve, reject) => { const request = db.transaction(store).objectStore(store).get(key); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
const put = (db, store, key, value) => new Promise((resolve, reject) => { const request = db.transaction(store, "readwrite").objectStore(store).put(value, key); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); });

export function createSandboxStorage({ db, fixture, fixtureVersion, media }) {
  const mediaId = () => crypto.randomUUID();
  const applyPendingMedia = async (state, pendingMedia) => {
    const next = clone(state);
    for (const item of pendingMedia) {
      const id = item.replacesCanonical ? item.id : mediaId();
      await media.put(id, item.file);
      const project = next.projects.find((candidate) => candidate.id === item.projectId);
      if (!project) continue;
      const group = project.gallery[item.galleryKind];
      const index = group.findIndex((candidate) => candidate.id === item.id);
      const value = { id: item.replacesCanonical ? item.id : `demo-${id}`, src: `images/demo/${id}`, alt: item.alt, ariaLabel: item.ariaLabel, presentation: item.presentation };
      if (index >= 0) group[index] = value; else group.push(value);
    }
    return normalizeProjectState(next);
  };
  return {
    clearsPendingMedia: true,
    validateMedia: async (file) => { await media.validate(file); },
    async load() { const meta = await get(db, "metadata", "fixtureVersion"); const saved = meta === fixtureVersion ? await get(db, "state", "saved") : null; return normalizeProjectState(saved ?? fixture); },
    async save(state, pendingMedia) { const next = await applyPendingMedia(state, pendingMedia); await media.prune(new Set(next.projects.flatMap((project) => [...project.gallery.desktop, ...project.gallery.mobile]).map((item) => item.src))); await put(db, "state", "saved", next); await put(db, "metadata", "fixtureVersion", fixtureVersion); return next; },
    async reset() { await resetDemoSandbox({ db, media }); return normalizeProjectState(fixture); },
  };
}
