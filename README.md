# Frontend Portfolio - Maksim Parfeniev

A multilingual personal portfolio website built with HTML, SCSS, vanilla JavaScript, ES modules, and a lightweight i18n system.

The site presents Maksim Parfeniev as a fullstack developer focused on React, TypeScript, Node.js/NestJS, real-world internal systems, and product prototypes.

## Features

- Responsive portfolio layout
- English/Russian language switcher
- Lightweight i18n dictionary with browser-language detection and manual localStorage override
- Featured project case studies rendered from the published API with a static fallback
- Real project screenshots
- Accessible navigation and mobile menu
- BEM-based CSS structure
- SEO metadata and social preview assets

## Tech Stack

- HTML5
- SCSS/CSS
- Vanilla JavaScript
- BEM methodology
- Static hosting / GitHub Pages-ready structure

## Project Structure

- `index.html` - main multilingual portfolio page
- `i18n.js` - EN/RU translation dictionary and language switching logic
- `script.js` - ES module for navigation, dynamic project rendering, and lightbox behavior
- `data/projects.js` - static fallback and presentation baseline for project cards
- `services/projects-source.js` - API-first project source with controlled fallback
- `mappers/project-api-mapper.js` - published API DTO adapter for the existing renderer
- `components/project-renderer.js` - DOM renderer for project cards
- `style.scss` - SCSS source styles
- `style.css` - compiled CSS used by the page
- `_mobile.scss` - deprecated mobile partial kept as a note for the old structure
- `images/projects/` - featured project screenshots
- `docs/design-reference/maxpar-cms-v1/` - standalone visual reference for a future CMS

## Featured Projects

- Construction Management Control Center / Центр управления строительством
- Project Bradbury
- FoodAI

## Local Usage

Start the API/CMS stack first, then serve the public frontend over HTTP so browser fetch and CORS use a real origin:

```bash
python3 -m http.server 8080
```

Then open `http://127.0.0.1:8080/`.

## Notes

The site uses a single multilingual `index.html` page. The old separate English page has been removed to avoid duplicate content.

`style.scss` is the source of truth for styles. Compile it to `style.css` with Dart Sass when changing styles:

```bash
sass --no-source-map style.scss style.css
```

The public frontend reads published projects from `http://127.0.0.1:3001/api/v1` at runtime. `data/projects.js` remains an active fallback and presentation baseline, so a controlled API failure never leaves the project section empty. The non-visible `html[data-projects-source]` diagnostic is `api` or `fallback`.

## Backend Foundation

Phase 2A backend foundation lives in `backend/`. It provides a local Docker Compose PostgreSQL + TypeScript Fastify public read API for the portfolio project data, while the public frontend continues to use `data/projects.js`.

## CMS Shell

Phase 3B adds project draft editing and explicit publishing to the private CMS. Draft saves never change the public API; publishing changes its normalized published read model atomically. After Phase 3C, a normal public page reload receives the new published API content.

Create/delete, media upload, scheduling, rollback, and Selectel deployment are not part of this implementation.

Local addresses:

- Public API: `http://127.0.0.1:3001`
- CMS: `http://127.0.0.1:5510/`
- CMS login: `http://127.0.0.1:5510/login`

The static fallback remains available when the API cannot be reached. It is not a production cache: CMS changes require a normal public page reload, and production deployment must configure a reachable public API base URL in the `portfolio-api-base-url` meta tag.

Open local CMS login:

- Standard function keys: `Ctrl + Shift + F12`
- MacBook media-key mode: `Fn + Ctrl + Shift + F12`

Run the local stack:

```bash
docker compose -f compose.portfolio.yml up -d
```

Run public checks with:

```bash
npm run check
npm test
```
