export const DEMO_DATABASE_NAME = "portfolio-public-demo-cms";
export const DEMO_DATABASE_VERSION = 1;
export const DEMO_DATABASE_STORES = Object.freeze(["state", "media", "metadata"]);
export const DEMO_FIXTURE_VERSION = "git-2cb01d1585b9c5fd88930ffc78ee1abaaed8fa43-81cd7429e6c5";
export const DEMO_STATE_KEY = "saved";
export const DEMO_FIXTURE_VERSION_KEY = "fixtureVersion";
export const DEMO_MEDIA_PREFIX = "images/demo/";
export const DEMO_MEDIA_RECORD_PREFIX = "sandbox:";

export function isDemoMediaReference(src) {
  return typeof src === "string" && src.startsWith(DEMO_MEDIA_PREFIX);
}

/** Converts a canonical static asset reference into an entrypoint-specific presentation URL. */
export function resolveStaticMediaUrl(src, baseUrl) {
  return new URL(src, baseUrl).href;
}
