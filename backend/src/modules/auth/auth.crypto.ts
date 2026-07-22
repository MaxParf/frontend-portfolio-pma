import bcrypt from "bcryptjs";
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

const BCRYPT_COST = 12;

export const DEFAULT_OWNER_LOGIN = "@maxpar.fed";

export function normalizeLogin(login: string): string {
  return login.trim().toLowerCase();
}

export function validatePasswordPolicy(password: string): void {
  const weakPasswords = new Set(["passwordpassword", "password1234", "123456789012", "qwerty123456", "adminadmin12"]);

  if (password.length < 12 || weakPasswords.has(password.toLowerCase()) || !/[a-z]/i.test(password) || !/[0-9]/.test(password)) {
    throw new Error("Password must be at least 12 characters and include letters and numbers.");
  }
}

export async function hashPassword(password: string): Promise<string> {
  validatePasswordPolicy(password);
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export function createSessionToken(): string {
  return `${randomUUID()}.${randomBytes(32).toString("base64url")}`;
}

export function hashSecret(value: string, pepper: string): string {
  return createHmac("sha256", pepper).update(value).digest("hex");
}

export function hashSessionToken(token: string, pepper: string): string {
  return hashSecret(`session:${token}`, pepper);
}

export function hashLogin(login: string, pepper: string): string {
  return hashSecret(`login:${normalizeLogin(login)}`, pepper);
}

export function hashRequestMetadata(value: string | undefined, pepper: string): string | null {
  if (!value) {
    return null;
  }
  return hashSecret(`metadata:${value}`, pepper);
}

export function constantTimeEqual(first: string, second: string): boolean {
  const firstHash = createHash("sha256").update(first).digest();
  const secondHash = createHash("sha256").update(second).digest();
  return timingSafeEqual(firstHash, secondHash);
}
