# Project media management

Managed project images are stored by the API in the `portfolio-media-data` Docker volume. The backend never exposes a storage path: public projects receive only `/api/v1/media/:assetId/display` URLs after publication.

## Media orientation

`vertical` and `horizontal` are the only media-orientation values. Orientation is presentation metadata on a `project_media` reference and in a draft/published revision snapshot; a physical `media_assets` row remains orientation-neutral because it may be reused in another project context. `sort_order` is unique only inside a project's orientation group. For legacy migration, usable dimensions classify `height > width` as `vertical` and `width >= height` (including square) as `horizontal`. Rows without usable dimensions remain unresolved (`NULL`) and are reported for controlled cleanup rather than guessed. Public gallery grouping and CMS orientation controls are a later phase.

The API accepts one JPEG, PNG, or WebP image per owner-authenticated request. Uploads are limited to 8 MB, 8,000 px per side, and 40 MP. The source is decoded with Sharp, stripped of metadata, and emitted as `display` (up to 2400 px) and `thumbnail` (up to 480 px) WebP variants.

An upload is `temporary`, becomes `draft` when saved into a project revision, and becomes `active` only during publish. Temporary and draft assets are owner-only; active assets are readable through the public delivery endpoint. Legacy `images/projects/**` records remain unchanged and stay compatible with old revisions.

`npm run media:cleanup` is a dry run. Pass `-- --execute` only after reviewing its candidates; it deletes only unreferenced temporary/draft managed records older than 24 hours.
