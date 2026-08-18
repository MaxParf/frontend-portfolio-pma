import { createPublicProjectState, normalizeProjectState } from "../../../project-core/project-normalizer.js";
import { validateProjectState } from "../../../project-core/project-validator.js";
import {
  DEMO_DATABASE_NAME,
  DEMO_DATABASE_VERSION,
  DEMO_FIXTURE_VERSION,
  DEMO_FIXTURE_VERSION_KEY,
  DEMO_MEDIA_RECORD_PREFIX,
  DEMO_STATE_KEY,
  isDemoMediaReference,
  resolveStaticMediaUrl,
} from "./contract.js";

const requestValue = (store, key) => new Promise((resolve, reject) => {
  const request = store.get(key);
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const requestAll = (store) => new Promise((resolve, reject) => {
  const request = store.getAll();
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

function closeDatabase(db) {
  try { db?.close(); } catch { /* An unavailable database must not affect public rendering. */ }
}

async function openExistingDemoDatabase(indexedDBImpl) {
  if (!indexedDBImpl?.databases || !indexedDBImpl.open) return null;
  let databases;
  try { databases = await indexedDBImpl.databases(); } catch { return null; }
  if (!Array.isArray(databases) || !databases.some((database) => database.name === DEMO_DATABASE_NAME && database.version === DEMO_DATABASE_VERSION)) return null;

  return new Promise((resolve) => {
    const request = indexedDBImpl.open(DEMO_DATABASE_NAME, DEMO_DATABASE_VERSION);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

function createPresentationState(state, urls, staticMediaBaseUrl) {
  const presentation = structuredClone(state);
  presentation.projects.forEach((project) => {
    ["desktop", "mobile"].forEach((group) => {
      project.gallery[group] = project.gallery[group].flatMap((item) => {
        if (isDemoMediaReference(item.src)) return urls.has(item.src) ? [{ ...item, src: urls.get(item.src) }] : [];
        return [{ ...item, src: resolveStaticMediaUrl(item.src, staticMediaBaseUrl) }];
      });
    });
  });
  return presentation;
}

/**
 * Reads only a saved, compatible Demo snapshot. A public page never creates a
 * database when no demo exists, and it never receives a write-capable repository.
 */
export async function loadSavedDemoSandbox({ fixtureVersion = DEMO_FIXTURE_VERSION, indexedDBImpl = globalThis.indexedDB, urlApi = globalThis.URL, staticMediaBaseUrl = globalThis.location?.origin ? `${globalThis.location.origin}/` : "https://portfolio.invalid/" } = {}) {
  const db = await openExistingDemoDatabase(indexedDBImpl);
  if (!db) return null;
  const objectUrls = [];

  try {
    const transaction = db.transaction(["metadata", "state", "media"], "readonly");
    const [savedFixtureVersion, savedState, media] = await Promise.all([
      requestValue(transaction.objectStore("metadata"), DEMO_FIXTURE_VERSION_KEY),
      requestValue(transaction.objectStore("state"), DEMO_STATE_KEY),
      requestAll(transaction.objectStore("media")),
    ]);
    if (savedFixtureVersion !== fixtureVersion || !savedState || !validateProjectState(savedState).valid) return null;

    const canonicalState = normalizeProjectState(savedState);
    const mediaByKey = new Map(media.map((record) => [record?.id, record?.blob]));
    const presentationUrls = new Map();
    const sources = canonicalState.projects.flatMap((project) => [...project.gallery.desktop, ...project.gallery.mobile]).map((item) => item.src).filter(isDemoMediaReference);
    for (const src of sources) {
      const id = src.slice("images/demo/".length);
      const blob = mediaByKey.get(`${DEMO_MEDIA_RECORD_PREFIX}${id}`);
      if (!(blob instanceof Blob) || !urlApi?.createObjectURL) continue;
      const url = urlApi.createObjectURL(blob);
      objectUrls.push(url);
      presentationUrls.set(src, url);
    }

    const state = createPublicProjectState(createPresentationState(canonicalState, presentationUrls, staticMediaBaseUrl));
    return {
      state,
      projects: state.projects,
      source: "demo-indexeddb",
      dispose: () => objectUrls.splice(0).forEach((url) => urlApi.revokeObjectURL?.(url)),
    };
  } catch {
    objectUrls.forEach((url) => urlApi?.revokeObjectURL?.(url));
    return null;
  } finally {
    closeDatabase(db);
  }
}
