# Known risks

- Application baseline was 130 entries; current documentation-inclusive worktree is 133 entries. Both lack recent Git checkpoints and mix unrelated changes.
- Current published-without-draft read-only flow is unaccepted and conflicts with the documented authoring target.
- Draft deletion and its browser acceptance remain unaccepted.
- Stale/missing Docker image references can hide source/runtime divergence.
- Tests do not substitute for browser/manual acceptance; some sessions have no embedded browser control.
- API/DTO changes, destructive smoke against real projects, locale pointer/projection mutation, and source/runtime confusion are high-risk boundaries.

## QA findings

- **CONFIRMED BLOCKER — QA-001:** CMS published-without-draft selects `PublishedReadOnly`; the backend DTO has `readOnly`, `ProjectInspector` replaces the editor, and its regression test fixes that behaviour. This violates the approved authoring invariant.
- **CRITICAL — REQUIRES TARGETED VERIFICATION — QA-002:** locale publication/projection infrastructure exists, but public-route source-of-truth wiring is not confirmed. Verify in `VERIFY-02-LOCALE-PUBLIC-ROUTE-SOURCE-OF-TRUTH` before claiming end-to-end cutover.
- **CRITICAL — REQUIRES TARGETED VERIFICATION — QA-003:** production migration/backfill entry point, invocation, idempotency, preservation of existing published projects/pointers/revisions/projections/media, and recovery implications remain unverified.
- **MAJOR — REQUIRES TARGETED VERIFICATION — QA-004:** backend locale contracts exist, but the actual CMS locale-publish user flow is not established by service/verifier tests; verify in `VERIFY-04`.
