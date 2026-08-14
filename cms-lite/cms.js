import { CmsApiError, changePassword, logout } from "./api.js";
import { mountCmsEditor } from "./editor/app.js";
import { validatePasswordChange } from "./password-change.js";
import { CMS_SESSION_KEY, canLeaveCms, clearCmsSession } from "./session.js";
import { createPhpStorage } from "./storage/php-api.js";

const root = document.getElementById("cms-root");
if (!sessionStorage.getItem(CMS_SESSION_KEY)) location.replace("/login/");
const app = mountCmsEditor({
  root, initialState: { version: 1, projects: [] },
  storage: createPhpStorage({ getToken: () => sessionStorage.getItem(CMS_SESSION_KEY) ?? "" }),
  chrome: {
    actionsHtml: () => '<button data-change-password class="cms-account-action" type="button">Сменить пароль</button><button data-logout class="cms-logout" type="button">Выйти</button>',
    extraHtml: () => '<dialog class="cms-password-dialog" data-password-dialog aria-labelledby="password-dialog-title"><form data-password-change-form method="post"><h2 id="password-dialog-title">Сменить пароль</h2><p data-password-change-message class="cms-password-dialog__message" role="status"></p><label class="cms-field"><span>Текущий пароль</span><input name="currentPassword" type="password" autocomplete="current-password" required></label><label class="cms-field"><span>Новый пароль</span><input name="newPassword" type="password" autocomplete="new-password" required></label><label class="cms-field"><span>Повторите новый пароль</span><input name="confirmPassword" type="password" autocomplete="new-password" required></label><div class="cms-password-dialog__actions"><button class="button button--primary" type="submit">Сменить пароль</button><button data-close-password type="button">Отмена</button></div></form></dialog>',
    async onAction(action, context) {
      if (action.logout !== undefined) { const snapshot = context.snapshot; if (!canLeaveCms({ dirty: snapshot.dirty, confirmLeave: (message) => window.confirm(message) })) return true; context.previewStore.dispose(); logout(sessionStorage.getItem(CMS_SESSION_KEY) ?? "").catch(() => {}); clearCmsSession(sessionStorage); location.assign("/login/"); return true; }
      if (action.changePassword !== undefined) { const dialog = root.querySelector("[data-password-dialog]"); dialog?.showModal(); return true; }
      if (action.closePassword !== undefined) { root.querySelector("[data-password-dialog]")?.close(); return true; }
      return false;
    },
  },
});
root.addEventListener("submit", (event) => {
  if (!event.target.matches("[data-password-change-form]")) return;
  event.preventDefault();
  const form = event.target; const credentials = Object.fromEntries(new FormData(form)); const validation = validatePasswordChange(credentials); const message = form.querySelector("[data-password-change-message]");
  if (!validation.valid) { message.textContent = validation.message; return; }
  changePassword(sessionStorage.getItem(CMS_SESSION_KEY) ?? "", { currentPassword: credentials.currentPassword, newPassword: credentials.newPassword }).then(() => { form.reset(); clearCmsSession(sessionStorage); location.assign("/login/"); }).catch((error) => { form.reset(); message.textContent = error instanceof CmsApiError ? "Не удалось сменить пароль." : "Сервис временно недоступен."; });
});
root.addEventListener("close", (event) => { if (event.target.matches("[data-password-dialog]")) event.target.querySelector("form")?.reset(); }, true);
app.load().catch((error) => { root.innerHTML = `<p class="cms-form-error" role="alert">${error.message}</p>`; });
window.addEventListener("beforeunload", (event) => { if (app.snapshot()?.dirty) { event.preventDefault(); event.returnValue = ""; } });
window.addEventListener("pagehide", () => app.dispose(), { once: true });
