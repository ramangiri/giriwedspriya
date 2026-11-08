# Giridharan ♥ Padma Priya — From Friends to Forever

A mobile-first wedding invitation with an eight-chapter scroll story, continuous dotted heart trail, animated paper plane and envelope-opening video.

## Website files

- `index.html` — page structure and eight story chapters
- `style.css` — responsive paper/scrapbook design, illustration effects and layouts
- `script.js` — scroll animations, paper plane, audio toggle, calendar download and sharing
- `assets/` — compressed opening MP4, poster frame, illustrations, textures and SVG details

## Preview locally

Open `index.html` or serve the folder with `python3 -m http.server 8000`.

The site is static and can be deployed with Netlify; no build command or database needed.

**Check details before publishing.** The ceremony time and temple were taken from the supplied invitation image and have not been separately confirmed. Reception: 8 February 2027, evening, Sri Alwaar Palace, Kattankulathur. Update `CONFIG` at the top of `script.js` and corresponding fallback text in `index.html` if required.

**Original intro note:** The included `assets/opening.mp4` is the optimized ~8-second opening animation to load quickly on mobile.

## Approved cartoon illustrations

All four approved location images are included in `assets/` and displayed in the website:

- `giri-house.webp`: corrected KING FITNESS building with the actual two-level facade, lower shops, and front gate; appears in Chapter 3.
- `priya-house.webp`: Priya's cream-and-green house with balconies and ornate gates; appears in Chapter 3.
- `temple-storybook.webp`: illustrated temple based on your temple photo, shown on the wedding details card in Chapter 8.
- `alwaar-palace-storybook.webp`: illustrated Sri Alwaar Palace based on your venue photo, shown on the reception details card in Chapter 8.

Venue pictures can be tapped to open the complete illustration. They are optimized WebP files and reveal gently when scrolled into view; the reduced-motion option keeps them static.

## Envelope-opening soundtrack

The opening video stays as `assets/opening.mp4` (the existing animation). A separate
`<audio>` player in `index.html` is wired to **`assets/invite-open.mp4`**.
Audio starts **only when guests tap anywhere on the opening screen**, not when
the page loads, and stops when the envelope video ends or fails.

**Required asset:** Add the original `invite-open.mp4` containing your chosen
soundtrack inside the repository's `assets/` folder. The audio is not currently
stored in this repository; until it is uploaded, the video still works silently.
The file can be uploaded directly on GitHub at `assets/invite-open.mp4`.
It is not necessary to extract audio separately; browsers can use the soundtrack
from the MP4 through the audio element.
