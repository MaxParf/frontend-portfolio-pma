import { z } from "zod";
import "dotenv/config";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().min(1),
  PORT: z.coerce.number().int().min(1).max(65535),
  DATABASE_URL: z.string().url(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  CORS_ORIGINS: z
    .string()
    .min(1)
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().url()).min(1)),
  CMS_ORIGINS: z
    .string()
    .min(1)
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().url()).min(1)),
  SESSION_COOKIE_NAME: z.string().min(1).default("maxpar_cms_session"),
  SESSION_TTL_SECONDS: z.coerce.number().int().min(900).max(86_400).default(28_800),
  SESSION_TOKEN_SECRET: z.string().min(32),
  COOKIE_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  LOGIN_RATE_LIMIT: z.coerce.number().int().min(1).max(100).default(10),
  MAX_FAILED_LOGIN_ATTEMPTS: z.coerce.number().int().min(3).max(20).default(5),
  LOGIN_LOCK_SECONDS: z.coerce.number().int().min(60).max(86_400).default(900),
  MEDIA_STORAGE_DRIVER: z.literal("local").default("local"),
  MEDIA_STORAGE_ROOT: z.string().min(1).default("./storage/project-media"),
  MEDIA_MAX_FILE_BYTES: z.coerce.number().int().min(1_024).max(32 * 1024 * 1024).default(8 * 1024 * 1024),
  MEDIA_MAX_FILES_PER_REQUEST: z.coerce.number().int().min(1).max(20).default(10),
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Invalid backend environment: ${issues}`);
  }

  return result.data;
}
