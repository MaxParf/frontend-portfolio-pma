# Selectel S3 Media Storage Runbook

Phase 3E.2 adds S3-compatible media storage support in the backend only. Do not paste access keys, secret keys, signed URLs, bucket policies, or raw provider responses into chat, Git, frontend code, CMS build args, or public runtime config.

## Access Model

The implementation uses backend-proxied reads with `S3_ACCESS_MODEL=private-proxy` as the production default.

Public-read buckets were considered because portfolio images are eventually public. They are not the default here because the current CMS workflow intentionally keeps uploaded managed images private until publish. A public-read object could be fetched by anyone who learns or guesses the object key before publish. Backend-proxied reads preserve the existing API contract, cache headers, draft/publish visibility, and frontend assumptions.

Direct browser upload is not part of this phase. Upload and delete operations use backend credentials only.

## Manual Selectel Setup

1. Create a dedicated Selectel service user for the portfolio.
2. Grant only the minimum S3 permissions needed for the selected bucket and prefix.
3. Issue a separate S3 access key for that service user.
4. Create a dedicated portfolio bucket.
5. Choose the storage class intentionally; changing it later may have restrictions.
6. Keep the bucket private for the default `private-proxy` model. If a later change chooses public-read, public listing must still remain disabled.
7. Configure CORS only if a future browser-direct workflow actually requires it.
8. Copy the actual endpoint, region, bucket name, supported addressing mode, and any public base URL/domain from the created Selectel storage/bucket settings. Do not invent an endpoint.
9. Put credentials only in `/opt/portfolio/env/portfolio.production.env`.
10. Set the environment file mode to `600`.
11. Run `deploy/scripts/validate-production-env.sh`.
12. Run the optional S3 probe manually with `deploy/scripts/verify-s3-storage.sh`.
13. Run a local-to-S3 migration dry run before switching existing production media traffic.
14. Run the controlled migration apply only after reviewing the dry-run inventory.
15. Run `deploy/scripts/smoke-production.sh`.
16. Manually verify owner upload, unpublished read rejection, publish, public read, and cleanup behavior.

## Required Environment

For S3:

```bash
STORAGE_PROVIDER=s3
MEDIA_STORAGE_DRIVER=s3
S3_ENDPOINT=https://...
S3_REGION=...
S3_BUCKET=...
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_FORCE_PATH_STYLE=false
S3_KEY_PREFIX=portfolio/media
S3_ACCESS_MODEL=private-proxy
S3_SIGNED_URL_TTL_SECONDS=300
```

Use `S3_FORCE_PATH_STYLE=true` only if the actual Selectel bucket endpoint requires path-style addressing. Virtual-hosted style remains preferred when supported.

`S3_PUBLIC_BASE_URL` is rejected with `private-proxy`. It is only relevant for a future explicit `public-read` switch.

## Connectivity Probe

The probe is manual and non-destructive to unrelated objects. It writes a tiny object under `${S3_KEY_PREFIX}/probes/<uuid>.webp`, checks visibility with `HeadObject`, and deletes only that object. It does not list the bucket and does not print credentials.

Do not run it without real approved production credentials.

## Migration Strategy

The database already stores `storage_driver` and variant `storage_key`, so no schema migration is required for Phase 3E.2.

For local-to-S3 migration:

1. Export a DB inventory of managed local media: asset id, variant, storage key, size, checksum where available, and status.
2. Dry-run target keys using `S3_KEY_PREFIX/assets/<asset-id>/<variant>.webp`.
3. For each eligible DB variant, read only the trusted DB key from the configured local media root.
4. Refuse path traversal and missing local files.
5. Check whether the target object already exists.
6. Do not overwrite existing objects unless an explicit reviewed flag is introduced.
7. Upload the object and verify size; use checksum when available.
8. Update `storage_driver` and variant keys only after upload verification.
9. Make the process resumable by skipping already migrated rows.
10. Report scanned, eligible, uploaded, skipped, failed, and DB-updated counts.
11. Do not delete local files in this phase.

A production migration tool should default to dry-run and require an explicit `--apply`. Bulk deletion of orphan objects must remain a separate reviewed operation.

## Backup And Recovery

Database backup contains media metadata and object keys, not S3 objects.

Selectel durability does not automatically replace a backup policy. Versioning, Object Lock, lifecycle rules, cross-region copies, and separate backup destinations are operational decisions to make before relying on S3 as the only copy.

Restoring the DB without matching objects can create broken media references. Recovery must compare DB keys with bucket objects before and after restore:

1. Export DB object-key inventory.
2. Export bucket object inventory for the portfolio prefix.
3. Detect DB references missing from the bucket.
4. Detect bucket objects not referenced by DB.
5. Dry-run all repair/deletion actions first.
6. Do not automatically bulk-delete orphan objects.

## Security Notes

The backend validates MIME, magic bytes, image dimensions, file size, storage keys, HTTPS endpoint rules, bucket names, key prefixes, and credential presence at startup. SVG upload remains unsupported. Raw SDK errors and credentials are not returned to clients.
