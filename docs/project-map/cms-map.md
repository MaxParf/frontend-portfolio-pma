# CMS map

`cms/src/main.tsx` mounts `App`; `App.tsx` owns auth, project list, selected id, editor, preview content, locale, and unsaved-change prompts. `CmsShell` composes `ProjectTree`, `ProjectInspector`, `PublishedPreview`, activity panel, and owner controls. `api/auth.ts`, `api/client.ts`, and `api/projects.ts` are the HTTP boundary.

Selection fetches `/editor`, or explicit `/published` for a published summary without a draft. `ProjectInspector` owns form/history/media state, save/publish/delete dialogs, and current `PublishedReadOnly` branch. `readOnly: true` is returned by the published endpoint; it shows published content and create-from-published confirmation. `POST .../draft/from-published` returns editor state; delete refreshes summary and selected editor. This is **CURRENT IMPLEMENTATION — PRODUCT REVIEW REQUIRED**, not accepted product behaviour. Relevant tests: `App.test.tsx`, `ProjectTree.test.tsx`, `ProjectInspector.test.tsx`, `PublishedPreview.test.tsx`.

**CONFIRMED BLOCKER — QA-001:** the published-without-draft branch is read-only and violates the approved authoring invariant. **MAJOR — REQUIRES TARGETED VERIFICATION — QA-004:** CMS clients and backend locale contracts are present, but locale-specific publish UX/end-to-end HTTP flow requires `VERIFY-04`; do not infer it from service/verifier coverage.
