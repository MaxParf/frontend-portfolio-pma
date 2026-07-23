import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const composePath = resolve(import.meta.dirname, "../../compose.portfolio.production.yml");

function service(compose: string, name: string): string {
  const start = compose.indexOf(`  ${name}:\n`);
  assert.notEqual(start, -1, `${name} service is missing`);
  const following = compose.slice(start + 1).search(/\n  [a-z0-9-]+:\n/);
  return compose.slice(start, following === -1 ? undefined : start + 1 + following);
}

test("production compose keeps DB private and grants S3 egress only to API and probe", async () => {
  const compose = await readFile(composePath, "utf8");
  const db = service(compose, "portfolio-db");
  const api = service(compose, "portfolio-api");
  const migrate = service(compose, "portfolio-migrate");
  const ownerBootstrap = service(compose, "portfolio-owner-bootstrap");
  const probe = service(compose, "portfolio-s3-probe");
  const cms = service(compose, "portfolio-cms");
  const publicSite = service(compose, "portfolio-public");

  assert.match(db, /networks: \[portfolio-production-private\]/);
  assert.doesNotMatch(db, /ports:/);
  assert.match(db, /security_opt: \[no-new-privileges:true\]/);
  assert.match(db, /cap_drop: \[ALL\]/);
  assert.match(db, /cap_add: \[CHOWN, DAC_OVERRIDE, FOWNER, SETGID, SETUID\]/);
  assert.doesNotMatch(db, /portfolio-production-egress/);
  assert.match(api, /networks: \[portfolio-production-private, portfolio-production-egress\]/);
  assert.match(probe, /networks: \[portfolio-production-egress\]/);
  assert.doesNotMatch(probe, /portfolio-production-private|depends_on:|DATABASE_URL/);
  assert.match(migrate, /networks: \[portfolio-production-private\]/);
  assert.match(ownerBootstrap, /networks: \[portfolio-production-private\]/);
  assert.match(cms, /networks: \[portfolio-production-private\]/);
  assert.match(publicSite, /networks: \[portfolio-production-private\]/);
  assert.doesNotMatch(cms, /env_file:|S3_/);
  assert.doesNotMatch(publicSite, /env_file:|S3_/);
  for (const serviceDefinition of [api, migrate, ownerBootstrap, probe, cms, publicSite]) {
    assert.doesNotMatch(serviceDefinition, /cap_add:/);
  }
  assert.match(compose, /portfolio-production-private:\n    name: portfolio-production-private\n    internal: true/);
  assert.match(compose, /portfolio-production-egress:\n    name: portfolio-production-egress\n/);
  assert.doesNotMatch(compose.slice(compose.indexOf("portfolio-production-egress:")), /internal: true/);
});
