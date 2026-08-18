export const CMS_SESSION_KEY = "portfolio-cms-lite-token";

export function clearCmsSession(storage) {
  storage.removeItem(CMS_SESSION_KEY);
}

export function canLeaveCms({ dirty, confirmLeave }) {
  return !dirty || confirmLeave("Есть несохранённые изменения. Выйти без сохранения?");
}
