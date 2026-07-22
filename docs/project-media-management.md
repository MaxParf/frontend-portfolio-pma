# Project media management

Managed project images are stored by the API in the `portfolio-media-data` Docker volume. The backend never exposes a storage path: public projects receive only `/api/v1/media/:assetId/display` URLs after publication.

The API accepts one JPEG, PNG, or WebP image per owner-authenticated request. Uploads are limited to 8 MB, 8,000 px per side, and 40 MP. The source is decoded with Sharp, stripped of metadata, and emitted as `display` (up to 2400 px) and `thumbnail` (up to 480 px) WebP variants.

An upload is `temporary`, becomes `draft` when saved into a project revision, and becomes `active` only during publish. Temporary and draft assets are owner-only; active assets are readable through the public delivery endpoint. Legacy `images/projects/**` records remain unchanged and stay compatible with old revisions.

`npm run media:cleanup` is a dry run. Pass `-- --execute` only after reviewing its candidates; it deletes only unreferenced temporary/draft managed records older than 24 hours.
