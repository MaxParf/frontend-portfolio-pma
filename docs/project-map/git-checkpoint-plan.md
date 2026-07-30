# Git checkpoint plan (proposal only)

0. **docs/stabilization-baseline** — only `AGENTS.md`, `docs/project-map/**`, `docs/review-package-template/**`; exclude all application files, migrations, tests, Docker, packages, runtime config, and generated files. Gates: exact inventory, `QA APPROVE_DOCUMENTATION_BASELINE`, owner authorization, `git diff --check`, exact staged-file review, and no unrelated staged files. Do not stage or commit in this task.

1. **migration-foundation** — migrations/schema/runners; gates: isolated migration rehearsal, backend typecheck/build; QA: DB review; manual: none.
2. **locale-publication-model** — contracts/materializer/public reader/verifiers; gates: locale/projection/lifecycle suites; QA: Model C review; manual: publication acceptance.
3. **cms-auth-and-editor** — CMS auth/editor tests with matching API contracts; gates: CMS/backend suites, Docker; QA: UI review; manual: owner flow.
4. **draft-discard-correction** — only after product decision restores editable lazy-draft model; gates: isolated preservation/concurrency/browser; QA and owner acceptance mandatory.
5. **media-and-runtime** — media changes, Docker/compose; gates: verifier, image/container proof; QA runtime review.
6. **documentation** — maps/READMEs only; gates: links/diff-check; QA documentation review.

Never make one aggregate dirty-worktree commit. Exclude generated maps unless provenance is reviewed; exclude the current published-read-only workflow until corrected and accepted.
