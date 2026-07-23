import type { AppEnv } from "./env.js";

export type OwnerBootstrapPolicy = {
  databasePurpose: AppEnv["DATABASE_PURPOSE"];
  allowTestOwnerBootstrap: boolean;
  databaseName: string;
};

export function databaseName(databaseUrl: string): string {
  const name = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ""));
  if (!name) throw new Error("DATABASE_URL must include a database name.");
  return name;
}

export function assertTestDatabaseName(name: string): void {
  if (!name.endsWith("_test")) throw new Error("TEST_DATABASE_NAME must end with _test.");
}

export function assertTestDatabase(env: AppEnv, action: string): void {
  const actualName = databaseName(env.DATABASE_URL);
  if (env.TEST_DATABASE_NAME) assertTestDatabaseName(env.TEST_DATABASE_NAME);
  if (env.DATABASE_PURPOSE !== "test" || !env.TEST_DATABASE_NAME || actualName !== env.TEST_DATABASE_NAME) {
    throw new Error(`${action} requires DATABASE_PURPOSE=test and DATABASE_URL for TEST_DATABASE_NAME.`);
  }
}

export function createOwnerBootstrapPolicy(env: AppEnv): OwnerBootstrapPolicy {
  const name = databaseName(env.DATABASE_URL);
  if (env.NODE_ENV === "test") {
    assertTestDatabase(env, "Test owner bootstrap");
    if (!env.ALLOW_TEST_OWNER_BOOTSTRAP) {
      throw new Error("Test owner bootstrap requires ALLOW_TEST_OWNER_BOOTSTRAP=true.");
    }
  }

  return { databasePurpose: env.DATABASE_PURPOSE, allowTestOwnerBootstrap: env.ALLOW_TEST_OWNER_BOOTSTRAP, databaseName: name };
}

export function assertOwnerBootstrapPolicy(policy: OwnerBootstrapPolicy): void {
  if (policy.databasePurpose === "test" && (!policy.allowTestOwnerBootstrap || !policy.databaseName)) {
    throw new Error("Test owner bootstrap requires an explicit isolated test database policy.");
  }
}

export function assertProductionDatabase(env: AppEnv, action: string): void {
  const actualName = databaseName(env.DATABASE_URL);
  if (
    env.NODE_ENV !== "production" ||
    env.DATABASE_PURPOSE !== "production" ||
    !env.PRODUCTION_DATABASE_NAME ||
    actualName !== env.PRODUCTION_DATABASE_NAME ||
    env.TEST_DATABASE_NAME ||
    env.ALLOW_TEST_OWNER_BOOTSTRAP
  ) {
    throw new Error(`${action} requires an explicit production database identity.`);
  }
  if (!env.COOKIE_SECURE) throw new Error(`${action} requires COOKIE_SECURE=true.`);
}
