import { mountCmsEditor } from "../../cms-lite/editor/app.js";
import { normalizeProjectState } from "../../project-core/project-normalizer.js";
import { openDemoDatabase, createSandboxMediaRepository, validateSandboxImage } from "./sandbox/media.js";
import { createSandboxStorage } from "./sandbox/storage.js";

const root = document.getElementById("cms-root");
const fixtureResponse = await fetch("./fixture/projects.fixture.json", { method: "GET", headers: { Accept: "application/json" } });
const manifestResponse = await fetch("./fixture/manifest.json", { method: "GET", headers: { Accept: "application/json" } });
if (!fixtureResponse.ok || !manifestResponse.ok) throw new Error("Не удалось загрузить fixture демо.");
const fixture = normalizeProjectState(await fixtureResponse.json()); const manifest = await manifestResponse.json();
const equivalent = (left, right) => JSON.stringify({ projects: normalizeProjectState(left).projects }) === JSON.stringify({ projects: normalizeProjectState(right).projects });
const db = await openDemoDatabase(); const media = createSandboxMediaRepository(db); media.validate = validateSandboxImage; await media.hydrate();
const storage = createSandboxStorage({ db, fixture, fixtureVersion: manifest.fixtureVersion, media });
let persisted = await storage.load(); let app;
const chrome = {
  title: "Portfolio CMS Demo",
  notice: "Демонстрационная среда — изменения сохраняются только в вашем браузере и не влияют на реальное портфолио.",
  connectionLabel: "Сохранение в браузере",
  actionsHtml: () => equivalent(persisted, fixture) ? "" : '<button data-reset-demo class="cms-reset-demo" type="button">Reset Demo</button>',
  extraHtml: () => '<dialog class="cms-reset-dialog" data-reset-dialog><form method="dialog"><h2>Восстановить исходное состояние демо?</h2><p>Все сохранённые изменения в этой демонстрационной среде будут удалены.</p><div class="cms-reset-dialog__actions"><button class="button button--primary" data-confirm-reset type="button">Восстановить</button><button data-cancel-reset type="button">Отмена</button></div></form></dialog>',
  async onAction(action) {
    if (action.resetDemo !== undefined) { root.querySelector("[data-reset-dialog]")?.showModal(); return true; }
    if (action.cancelReset !== undefined) { root.querySelector("[data-reset-dialog]")?.close(); return true; }
    if (action.confirmReset !== undefined) { root.querySelector("[data-reset-dialog]")?.close(); persisted = await storage.reset(); await app.load(); return true; }
    return false;
  },
};
app = mountCmsEditor({ root, initialState: fixture, storage, mediaResolver: media, chrome, onPersistedChange: (state) => { persisted = state; } });
await app.load();
window.addEventListener("pagehide", () => { app.dispose(); media.dispose(); db.close(); }, { once: true });
