export function validatePasswordChange({ currentPassword, newPassword, confirmPassword }) {
  if (!currentPassword || !newPassword || !confirmPassword) return { valid: false, message: "Заполните все поля." };
  if (currentPassword === newPassword) return { valid: false, message: "Новый пароль должен отличаться от текущего." };
  if (newPassword !== confirmPassword) return { valid: false, message: "Новый пароль и подтверждение не совпадают." };
  return { valid: true };
}

// Phase 4 replaces this isolated adapter with the authenticated server request.
export async function requestPasswordChange(_credentials) {
  return { changed: false, code: "PASSWORD_CHANGE_SERVER_NOT_CONFIGURED" };
}
