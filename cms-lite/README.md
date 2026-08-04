# Portfolio CMS Lite local foundation

Run the isolated memory-only CMS at the expected local route:

```bash
node dev-server.mjs
```

It serves `/` and `/login/` on `127.0.0.1:5511`, while exposing the canonical fixture and shared renderer modules from the repository root. It is a development route adapter only: it has no PHP, API, persistence, or deployment role.
# PHP persistence (Phase 4)

Start the local CMS Lite server separately, then start the PHP document-root simulation:

```sh
php cms-api/scripts/init-storage.php owner
php -S 127.0.0.1:5520 -t cms-api/public
```

The bootstrap prompts twice for a password and writes only a password hash to ignored `cms-api/private-dev/`. For automated isolated checks, use `CMS_BOOTSTRAP_PASSWORD` only as a process environment variable, never as a command-line argument. Production must provide `PORTFOLIO_PRIVATE_DATA_ROOT`, `PORTFOLIO_PUBLIC_ROOT`, and `CMS_ALLOWED_ORIGIN`; private data must remain outside the PHP document root.
