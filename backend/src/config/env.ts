import { z } from "zod";
import "dotenv/config";

const storageProviderSchema = z.enum(["local", "s3"]);

const rawEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().min(1),
  PORT: z.coerce.number().int().min(1).max(65535),
  DATABASE_URL: z.string().url(),
  DATABASE_PURPOSE: z.enum(["development", "test", "production"]).optional(),
  TEST_DATABASE_NAME: z.string().min(1).optional(),
  PRODUCTION_DATABASE_NAME: z.string().min(1).optional(),
  ALLOW_TEST_OWNER_BOOTSTRAP: z.enum(["true", "false"]).optional().transform((value) => value === "true"),
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
  STORAGE_PROVIDER: storageProviderSchema.optional(),
  MEDIA_STORAGE_DRIVER: storageProviderSchema.optional(),
  MEDIA_STORAGE_ROOT: z.string().min(1).default("./storage/project-media"),
  MEDIA_PROCESSING_TMP_DIR: z.string().min(1).default("/tmp/portfolio-media-processing"),
  MEDIA_MAX_FILE_BYTES: z.coerce.number().int().min(1_024).max(32 * 1024 * 1024).default(8 * 1024 * 1024),
  MEDIA_MAX_FILES_PER_REQUEST: z.coerce.number().int().min(1).max(20).default(10),
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().min(1).max(64).optional(),
  S3_BUCKET: z.string().min(3).max(63).optional(),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  S3_FORCE_PATH_STYLE: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  S3_KEY_PREFIX: z.string().min(1).max(180).default("portfolio/media"),
  S3_ACCESS_MODEL: z.enum(["private-proxy", "public-read"]).default("private-proxy"),
  S3_PUBLIC_BASE_URL: z.string().url().optional(),
  S3_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(300),
}).transform((value) => {
  const provider = value.STORAGE_PROVIDER ?? value.MEDIA_STORAGE_DRIVER ?? (value.NODE_ENV === "production" ? undefined : "local");
  return { ...value, STORAGE_PROVIDER: provider, MEDIA_STORAGE_DRIVER: provider };
}).superRefine((value, ctx) => {
  if (!value.STORAGE_PROVIDER) {
    ctx.addIssue({ code: "custom", path: ["STORAGE_PROVIDER"], message: "STORAGE_PROVIDER is required in production." });
    return;
  }

  if (!storageProviderSchema.safeParse(value.STORAGE_PROVIDER).success) {
    ctx.addIssue({ code: "custom", path: ["STORAGE_PROVIDER"], message: "Unsupported storage provider." });
    return;
  }

  if (value.STORAGE_PROVIDER === "local") {
    if (!value.MEDIA_STORAGE_ROOT) ctx.addIssue({ code: "custom", path: ["MEDIA_STORAGE_ROOT"], message: "MEDIA_STORAGE_ROOT is required for local storage." });
    if (value.NODE_ENV === "production" && (value.MEDIA_STORAGE_ROOT.startsWith("/tmp") || value.MEDIA_STORAGE_ROOT === "." || value.MEDIA_STORAGE_ROOT.includes("/src"))) {
      ctx.addIssue({ code: "custom", path: ["MEDIA_STORAGE_ROOT"], message: "Production local media root must be an explicit persistent path." });
    }
  }

  if (value.STORAGE_PROVIDER === "s3") {
    for (const key of ["S3_ENDPOINT", "S3_REGION", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const) {
      if (!value[key]) ctx.addIssue({ code: "custom", path: [key], message: `${key} is required for S3 storage.` });
    }
    if (value.S3_ENDPOINT && value.NODE_ENV === "production" && new URL(value.S3_ENDPOINT).protocol !== "https:") {
      ctx.addIssue({ code: "custom", path: ["S3_ENDPOINT"], message: "S3_ENDPOINT must use HTTPS in production." });
    }
    if (value.S3_BUCKET && !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(value.S3_BUCKET)) {
      ctx.addIssue({ code: "custom", path: ["S3_BUCKET"], message: "S3_BUCKET must be a valid bucket name." });
    }
    if (!/^[a-zA-Z0-9][a-zA-Z0-9/_-]*[a-zA-Z0-9]$/.test(value.S3_KEY_PREFIX) || value.S3_KEY_PREFIX.includes("..") || value.S3_KEY_PREFIX.includes("//")) {
      ctx.addIssue({ code: "custom", path: ["S3_KEY_PREFIX"], message: "S3_KEY_PREFIX must be a normalized object-key prefix." });
    }
    if (value.S3_ACCESS_MODEL === "public-read") {
      if (!value.S3_PUBLIC_BASE_URL) ctx.addIssue({ code: "custom", path: ["S3_PUBLIC_BASE_URL"], message: "S3_PUBLIC_BASE_URL is required for public-read S3 media." });
      if (value.S3_PUBLIC_BASE_URL && value.NODE_ENV === "production" && new URL(value.S3_PUBLIC_BASE_URL).protocol !== "https:") {
        ctx.addIssue({ code: "custom", path: ["S3_PUBLIC_BASE_URL"], message: "S3_PUBLIC_BASE_URL must use HTTPS in production." });
      }
    }
    if (value.S3_ACCESS_MODEL === "private-proxy" && value.S3_PUBLIC_BASE_URL) {
      ctx.addIssue({ code: "custom", path: ["S3_PUBLIC_BASE_URL"], message: "S3_PUBLIC_BASE_URL is not used with private-proxy media." });
    }
  }
});

export type AppEnv = z.infer<typeof rawEnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const result = rawEnvSchema.safeParse(source);

  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Invalid backend environment: ${issues}`);
  }

  return result.data;
}
