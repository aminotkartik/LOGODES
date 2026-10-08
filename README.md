# Campus+

A cinematic, interactive identity experience for a student-focused platform. The mark is an original vector system: an open, connected `C` with a forward-moving plus and an energy arc that brings the wordmark into focus.

## Run locally

This is a dependency-free browser build at runtime. GSAP and the font files are vendored under `assets/` so the experience works without a network connection after checkout.

```bash
npm install
npm start
```

Then open `http://localhost:4173`.

## Included

- Inline SVG wordmark, icon, arc, comet, stars, and reusable particles
- GSAP reveal timeline through `playCampusIntro()`
- Replay, pause, sound toggle, hover/magnetic motion, plus micro-interaction, and touch support
- Responsive desktop/tablet/mobile layout
- `prefers-reduced-motion` fallback
- Identity panel with downloadable icon and wordmark SVG assets
- Local Outfit and DM Sans fonts

The standalone icon is at `assets/campus-icon.svg`. The main implementation is intentionally kept to `index.html`, `style.css`, and `script.js`.
