# Frontend Portfolio - Maksim Parfeniev

A multilingual personal portfolio website built with HTML, SCSS, vanilla JavaScript, and a lightweight i18n system.

The site presents Maksim Parfeniev as a fullstack developer focused on React, TypeScript, Node.js/NestJS, real-world internal systems, and product prototypes.

## Features

- Responsive portfolio layout
- English/Russian language switcher
- Lightweight i18n dictionary with localStorage persistence
- Featured project case studies
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
- `script.js` - navigation and UI behavior
- `style.scss` - SCSS source styles
- `style.css` - compiled CSS used by the page
- `_mobile.scss` - deprecated mobile partial kept as a note for the old structure
- `images/projects/` - featured project screenshots

## Featured Projects

- Construction Management Control Center / Центр управления строительством
- FoodAI

## Local Usage

Open `index.html` directly in a browser or serve the folder with a local static server:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080/`.

## Notes

The site uses a single multilingual `index.html` page. The old separate English page has been removed to avoid duplicate content.
