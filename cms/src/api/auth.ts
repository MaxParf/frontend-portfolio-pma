import { apiFetch } from "./client";
import type { AdminUser } from "./types";

export function getCurrentUser(): Promise<{ data: AdminUser }> {
  return apiFetch("/api/v1/admin/auth/me");
}

export function login(email: string, password: string): Promise<{ data: AdminUser }> {
  return apiFetch("/api/v1/admin/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function logout(): Promise<{ data: { loggedOut: boolean } }> {
  return apiFetch("/api/v1/admin/auth/logout", {
    method: "POST",
  });
}
