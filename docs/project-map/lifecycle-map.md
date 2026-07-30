# Lifecycle map

Auth: login → server session → `/me` on reload → logout/revoke. Project authoring: create draft → save revisions → publish immutable source/materialization → edit → republish. Current published-without-draft implementation: select → `/published` read-only response → explicit clone action → editable draft → delete pointer → read-only again; **PRODUCT REVIEW REQUIRED**. Desired target: published source → editable memory form → lazy draft only on first save.

Locale: editor source → locale publication revision → per-locale pointer/generation → publication-owned projection → public candidate. Media: upload asset/variants → draft reference → published projection reference → orphan verifier/cleanup. Invariants: GET does not mutate; published revisions/pointers remain immutable unless publish service; projection is not editable source; discard is not project deletion; row locks protect concurrent writers.

**CURRENT IMPLEMENTATION:** locale lifecycle services/verifiers and storage exist. **APPROVED TARGET:** public route, production backfill, and CMS locale-publish acceptance require separate evidence. **CRITICAL — REQUIRES TARGETED VERIFICATION:** production backfill must prove entry point, invocation, idempotency, preservation, and recovery before lifecycle completeness is claimed.
