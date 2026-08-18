import { CMS_SESSION_KEY } from "./session.js";
import { CmsApiError, login as loginRequest } from "./api.js";

const form = document.querySelector("[data-login-form]");

if (sessionStorage.getItem(CMS_SESSION_KEY)) location.replace("/");

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  const credentials = new FormData(form);
  const login = credentials.get("login")?.trim();
  const password = credentials.get("password")?.trim();
  if (!login || !password) return;
  const error = document.querySelector("[data-login-error]");
  loginRequest({ login, password }).then((session) => {
    sessionStorage.setItem(CMS_SESSION_KEY, session.token);
    location.assign("/");
  }).catch((requestError) => {
    if (error) { error.hidden = false; error.textContent = requestError instanceof CmsApiError && requestError.status === 401 ? "Неверные данные для входа." : "Не удалось выполнить вход."; }
  });
});
