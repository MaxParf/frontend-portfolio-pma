# Quality gates

No gate proves application acceptance without a filled task contract. Every command record must state command owner, working directory, prerequisites, repository mutation, local DB mutation, isolated DB identity, cleanup proof, expected duration, parallel allowance, artifact location, and required exit code `0`.

## Operational command records

Every executed command must have one separate, completed command record in the task review package. A command without a completed operational record is not gate evidence. Use only these proof classes: `STATIC PROOF`, `AUTOMATED TEST PROOF`, `VERIFIER PROOF`, `RUNTIME PROOF`, and `OWNER MANUAL ACCEPTANCE`.

```markdown
### Command ID: <stable task-local ID>

| Field | Record |
|---|---|
| Proof class | <allowed proof class> |
| Command owner | <person or role> |
| Command | `<exact command>` |
| Working directory | `<absolute path>` |
| Purpose | <what this proves> |
| Prerequisites | <required state, or `none`> |
| Repository mutation | yes/no |
| Local DB mutation | yes/no |
| Docker/runtime mutation | yes/no |
| Isolated DB identity | <identity, or `NOT APPLICABLE`> |
| Cleanup required | yes/no |
| Cleanup command | <command, or `NOT APPLICABLE`> |
| Cleanup proof | <artifact, or `NOT APPLICABLE`> |
| Parallel execution allowed | yes/no |
| Expected duration | <estimate> |
| Started at | <ISO 8601 timestamp> |
| Finished at | <ISO 8601 timestamp> |
| Exit code | <integer, or `NOT RUN`> |
| Result | PASS/FAIL/BLOCKED/NOT RUN |
| Artifact path | <stdout/stderr or other evidence path> |
| Known limitations | <limitation, or `none`> |
| Reviewer notes | <notes, or `none`> |
```

Operational rules:

1. One actually executed command equals one separate command record.
2. Do not combine multiple shell commands under one exit code when their results must be proved separately.
3. If a compound command is used, list every subcommand and record the aggregate and individual results when available.
4. `Result` may only be `PASS`, `FAIL`, `BLOCKED`, or `NOT RUN`.
5. `NOT RUN` and `BLOCKED` require a reason.
6. Every executed command requires an exit code.
7. A read-only command must explicitly record `no` for all mutation flags.
8. A DB-mutating command requires an isolated DB identity and cleanup proof.
9. A runtime command requires applicable image, container, and runtime identifiers.
10. `Artifact path` must identify retained stdout/stderr or equivalent evidence.
11. A command without a completed operational record does not prove a gate.
12. Complete the task contract before application acceptance review.

## STATIC PROOF

Owner: developer. Commands: affected `npm run typecheck`, `npm run build`, root `npm run check`, `git diff --check`. DB/repository mutation: no, except generated build output if configured; preserve artifact path and exit code.

## AUTOMATED TEST PROOF

Owner: developer. Commands: root `npm test`, backend `npm test`, CMS `npm test`, targeted tests. Backend/integration commands may mutate only a proven isolated `_test` DB; capture identity and cleanup proof. Do not parallelize destructive test contours.

## VERIFIER PROOF

Owner: developer/QA. Commands: existing backend `verify:*` scripts. Record locale baseline prerequisites and distinguish prepared isolated evidence from production claims.

## RUNTIME PROOF

Owner: developer. Docker build, image/container IDs, health, API smoke, source/bundle hashes. Record ports, image IDs, artifacts, mutations and exit codes.

## OWNER MANUAL ACCEPTANCE

Owner: portfolio owner. Browser scenario, safe fixture, console/network result, screenshots and final verdict. UI component tests and unavailable browser automation do not replace this gate.
