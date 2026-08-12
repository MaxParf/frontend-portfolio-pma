# Portfolio CMS Desktop v1

`Portfolio CMS.app` is a native macOS launcher for the owner-only CMS Lite. It opens the system browser at `http://127.0.0.1:5511/login/` and uses `https://www.maxpar.ru/cms-api`; it does not publish CMS on a public subdomain.

## Dependency impact

- **Inputs:** only Git objects from `cf5832091250c28363eedf56888074798a727146`. `scripts/build-runtime.sh` archives the explicit server allowlist/runtime graph, never the working tree.
- **Runtime contract:** `cms-lite/dev-server.mjs` is run directly by bundled Node 24.19.0 with `CMS_LITE_PORT=5511`. Its existing `127.0.0.1` bind and route allowlist are unchanged.
- **Consumers:** the app owns only startup, readiness, browser opening and its child process. CMS routes, API DTOs, auth/session storage, PHP, backend and legacy `cms/` are not imported, copied or changed.
- **Regression boundary:** a matching Lite listener is reused; a foreign response on port 5511 is never killed. The immutable runtime contains no private state, credentials, tests, backend, CMS API, Git metadata or working-tree files.

## Build

```sh
desktop/portfolio-cms/scripts/build-app.sh
```

The result is `/tmp/portfolio-cms-desktop-build/Portfolio CMS.app`. The build downloads the pinned official Node archive only to a temporary cache, verifies its hard-coded official SHA-256, and does not run `npm install`.

## Manual smoke

1. Double-click `Portfolio CMS.app` (or run `open` on it).
2. Confirm the browser opens the local login URL.
3. Confirm login requests use `https://www.maxpar.ru/cms-api` in browser Network.
4. Start the app again: it must reuse the running server.
5. Bind a non-CMS HTTP process to port 5511 and confirm the launcher shows an error without terminating that process.
