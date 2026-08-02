# Senior QA workflow

Codex VS Code developer produces `IMPLEMENTATION_READY_FOR_REVIEW` plus `/tmp/<task-id>-review/`. Independent Senior QA returns `APPROVE_FOR_MANUAL_TEST`, `APPROVE_WITH_CONDITIONS`, or `REJECT`. Owner performs manual acceptance; only then may status become `ACCEPTED` and a separately authorized Git checkpoint be considered.

If the task contract is missing or empty, QA must not expand scope or aggregate-audit the dirty worktree: return `MISSING_REVIEW_INPUT` and request a completed package. Preliminary out-of-scope findings may be registered, but do not replace targeted verification or accept/reject unrelated change sets.
