# Nova Black — Site Template

A sleek black site template by InfinityTeck.

## Structure

```
nova-black-site/
├── index.html          ← Main entry point
└── public/
    ├── css/
    │   └── style.css   ← All global styles
    ├── js/
    │   └── app.js      ← Page router & nav logic
    └── pages/          ← Drop extra page files here
```

## Pages
- **Home** — Dashboard with quick links
- **Music** — Player, playlists, discovery
- **Chat** — Rooms, DMs, announcements
- **Games** — Arcade, multiplayer, leaderboard
- **Tools** — Editor, generator, converter

## How to Use
Just open `index.html` in a browser — no build step needed.

To add a new page:
1. Add a nav link in `index.html` with `data-page="yourpage"`
2. Add a `<section id="page-yourpage" class="page">` block
3. Add an entry to the `meta` object in `public/js/app.js`
