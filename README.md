# Frontend Portfolio - Maksim Parfeniev

A multilingual personal portfolio website built with HTML, SCSS, vanilla JavaScript, ES modules, and a lightweight i18n system.

The site presents Maksim Parfeniev as a fullstack developer focused on React, TypeScript, Node.js/NestJS, real-world internal systems, and product prototypes.

## Features

- Responsive portfolio layout
- English/Russian language switcher
- Lightweight i18n dictionary with browser-language detection and manual localStorage override
- Featured project case studies rendered from a static data layer
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
- `data/projects.js` - static project data model
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

Open `index.html` directly in a browser or serve the folder with a local static server:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080/`.

## Notes

The site uses a single multilingual `index.html` page. The old separate English page has been removed to avoid duplicate content.

`style.scss` is the source of truth for styles. Compile it to `style.css` with Dart Sass when changing styles:

```bash
sass --no-source-map style.scss style.css
```

The public frontend baseline remains static and continues to use `data/projects.js`. Backend API, PostgreSQL, owner authentication, and CMS shell code live in isolated local-only project areas.

## Backend Foundation

Phase 2A backend foundation lives in `backend/`. It provides a local Docker Compose PostgreSQL + TypeScript Fastify public read API for the portfolio project data, while the public frontend continues to use `data/projects.js`.

## CMS Shell

Phase 3A adds a private read-only CMS shell in `cms/` and owner authentication in `backend/`.

Local addresses:

- Public API: `http://127.0.0.1:3001`
- CMS: `http://127.0.0.1:5510/`
- CMS login: `http://127.0.0.1:5510/login`

The public frontend still uses `data/projects.js`. The only public frontend integration is the hidden CMS shortcut, which opens the local CMS login screen in a new tab. It is a UX shortcut only, not an auth mechanism.

Open local CMS login:

- Standard function keys: `Ctrl + Shift + F12`
- MacBook media-key mode: `Fn + Ctrl + Shift + F12`

Run the local stack:

```bash
docker compose -f compose.portfolio.yml up -d
```
