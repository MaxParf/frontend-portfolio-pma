import { DEMO_DATABASE_NAME, DEMO_DATABASE_STORES, DEMO_DATABASE_VERSION, isDemoMediaReference, resolveStaticMediaUrl } from "./contract.js";

const DB_NAME = DEMO_DATABASE_NAME;
const DB_VERSION = DEMO_DATABASE_VERSION;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 32 * 1024 * 1024;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function openDemoDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => { const db = request.result; for (const name of DEMO_DATABASE_STORES) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Не удалось открыть хранилище демо."));
  });
}
const transaction = (db, store, mode, operation) => new Promise((resolve, reject) => { const request = operation(db.transaction(store, mode).objectStore(store)); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error ?? new Error("Ошибка хранилища демо.")); });

export async function validateSandboxImage(file) {
  if (!TYPES.has(file.type) || file.size < 1 || file.size > MAX_FILE_BYTES) throw new Error("Поддерживаются JPEG, PNG и WebP до 8 МБ.");
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error("Файл не является корректным изображением.");
  bitmap.close();
}

export function createSandboxMediaRepository(db, { staticMediaBaseUrl = globalThis.document?.baseURI } = {}) {
  const urls = new Map();
  const keyFor = (id) => `sandbox:${id}`;
  return {
    async put(id, blob) {
      const existing = await transaction(db, "media", "readonly", (store) => store.getAll());
      const used = existing.reduce((total, item) => total + (item?.blob?.size ?? 0), 0);
      if (used + blob.size > MAX_TOTAL_BYTES) throw new Error("Превышен лимит изображений демо (32 МБ).");
      await transaction(db, "media", "readwrite", (store) => store.put({ id: keyFor(id), blob }, keyFor(id)));
      this.revoke(id);
      urls.set(id, URL.createObjectURL(blob));
    },
    async remove(id) { this.revoke(id); await transaction(db, "media", "readwrite", (store) => store.delete(keyFor(id))); },
    async prune(references) { const entries = await transaction(db, "media", "readonly", (store) => store.getAll()); for (const entry of entries) { const id = entry?.id?.startsWith("sandbox:") ? entry.id.slice(8) : null; if (id && !references.has(`images/demo/${id}`)) await this.remove(id); } },
    async clear() { this.dispose(); await transaction(db, "media", "readwrite", (store) => store.clear()); },
    resolve(src) { if (!isDemoMediaReference(src)) return resolveStaticMediaUrl(src, staticMediaBaseUrl); const id = src.slice("images/demo/".length); return urls.get(id) ?? null; },
    async hydrate() { const entries = await transaction(db, "media", "readonly", (store) => store.getAll()); for (const entry of entries) { const id = entry?.id ?? ""; if (entry?.blob && id.startsWith("sandbox:")) urls.set(id.slice(8), URL.createObjectURL(entry.blob)); } },
    async urlFor(id) { const record = await transaction(db, "media", "readonly", (store) => store.get(keyFor(id))); if (!record?.blob) return null; this.revoke(id); const url = URL.createObjectURL(record.blob); urls.set(id, url); return url; },
    revoke(id) { const url = urls.get(id); if (url) URL.revokeObjectURL(url); urls.delete(id); },
    dispose() { for (const id of [...urls.keys()]) this.revoke(id); },
  };
}

export { DB_NAME, DB_VERSION };
