# Maxpar CMS Shell

Phase 3B private CMS frontend for the Maxpar portfolio.

## Scope

This is a closed owner CMS shell, not a demo CMS. It requires backend server-side session validation before loading project data.

Owner model:

- exactly one owner
- login: `@maxpar.fed`
- authentication: login + password
- no registration, invitations, password reset, role selection, or additional users

Implemented:

- `/login` login screen
- `/` protected CMS shell
- desktop-only gate below 1200 px
- top bar with environment, API status, user, logout
- project editor with EN/RU content, links, technologies, and media metadata
- local draft preview with EN/RU switch
- explicit Save draft and Publish confirmation
- dirty-state protection for project switching, logout, and browser reload/close
- conflict reload action and read-only revision summary
- local UI-only session activity panel

Not implemented:

- create/delete
- hide/archive
- media upload
- scheduling
- draft live preview tokens
- password reset
- MFA
- production deployment

## Local Addresses

- CMS: `http://127.0.0.1:5510/`
- Login: `http://127.0.0.1:5510/login`
- API: `http://127.0.0.1:3001`

## Environment

Copy `.env.example` to `.env` if running outside Compose:

```bash
VITE_API_BASE_URL=http://127.0.0.1:3001
```

No secrets belong in CMS environment variables. The CMS uses cookie-based auth with `fetch(..., { credentials: "include" })`.

## Commands

```bash
npm ci
npm run dev
npm run typecheck
npm test
npm run build
npm audit --omit=dev
npm run test:e2e
```

The dev server is pinned to `127.0.0.1:5510`.

`npm run test:e2e` uses local Google Chrome through Playwright. It requires `CMS_TEST_PASSWORD` in the environment and never has a password default. The browser scenario restores the published baseline and logs out. Browser reports, traces, and screenshots are ignored by Git.

## Authentication

The login form contains only `Login`, `Password`, and `Sign in`. The CMS never receives or stores a session token in JavaScript. Login calls the backend, and the backend sets an HttpOnly cookie. The shell checks `/api/v1/admin/auth/me`; unauthenticated users are sent to `/login`.

## Local Shortcut

Open local CMS login from the public frontend:

- Standard function keys: `Ctrl + Shift + F12`
- MacBook media-key mode: `Fn + Ctrl + Shift + F12`

This shortcut is only local UX. It is not a security feature.

## Desktop Requirement

The main three-panel shell renders only at widths of 1200 px and above. Smaller screens show a desktop gate with a logout button. This is a product UI constraint, not a security boundary.
