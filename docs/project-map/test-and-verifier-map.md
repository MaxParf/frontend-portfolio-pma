# Test and verifier map

| Command | Directory | Scope / prerequisite | DB mutation caveat |
|---|---|---|---|
| `npm test`, `npm run check` | root | static frontend mapper tests/check | no |
| `npm run typecheck`, `npm run build`, `npm test` | `backend` | TypeScript/build/isolated suite; guarded test DB | tests mutate isolated DB |
| `npm run verify:lifecycle`, `verify:projections` | `backend` | lifecycle/projection audit | inspect command prerequisites |
| `npm run verify:locale-publications`, `verify:locale-projections`, `verify:locale-lifecycle` | `backend` | locale Model C verification; prepared isolated baseline required | do not use raw legacy bootstrap as production evidence |
| `npm run verify:media-orphans`, `verify:s5-locale-rehearsal` | `backend` | media/rehearsal coverage | inspect temp DB cleanup |
| `npm test`, `npm run typecheck`, `npm run build` | `cms` | Vitest/CMS static build | no DB |
| `npm run test:e2e:isolated` | `cms` | isolated API/CMS/browser contour | test DB/storage and browser availability |

Expected duration and exact effects depend on current environment. Treat browser E2E and verifier results separately from static tests.
