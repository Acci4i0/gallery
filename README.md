# Photo Field

A scatter of photos floating in 3D space on a white background. They drift gently, react to the
mouse with parallax, can be dragged through the field, and grow on hover. Far photos shrink and
dissolve into the white via fog.

Vanilla HTML/CSS/JS — no framework, no bundler, no npm, no build step. Just open `index.html`.

> **Rebuild study** of the portfolio of **Malik Kotb** (`malik.url`). See [CREDITS.md](./CREDITS.md).

## Run it

Serve the folder with any static server and open it in the browser:

```bash
python -m http.server 8000
# then open http://localhost:8000
```

Everything uses relative paths, so it behaves identically on **GitHub Pages** (where no local server
is needed — just open the published URL).

> **Why a server and not a double-click?** Browsers (Chrome in particular) refuse to use images
> loaded from `file://` as WebGL textures — the local file counts as a different origin, so the photos
> would render as blank rectangles. Any `http://` origin (a local server or GitHub Pages) fixes this.

Two libraries load from CDN (an internet connection is needed the first time):

- Three.js r128
- GSAP 3.12.5

## Add a photo

Two steps, nothing else:

1. Drop the file into `photos/` (any aspect ratio — horizontal or vertical; it keeps its real
   proportions, never cropped to a square).
2. Add one line to [`js/media.js`](./js/media.js):

   ```js
   export const MEDIA = [
     './photos/01.jpg',
     // ...
     './photos/my-new-photo.jpg',
   ];
   ```

The current `photos/` are flat-color placeholders. Replace them with your own (see the
`// TODO` in `media.js`). There can be more planes on screen than photos — a photo simply repeats
at different positions.

## Tuning

Every parameter lives in the `FIELD` object at the top of [`js/photo-field.js`](./js/photo-field.js):

| Param | Meaning |
| --- | --- |
| `count` | Number of planes on screen (24–40 is the sweet spot). |
| `spreadX` / `spreadY` | Half-size of the field horizontally / vertically. |
| `depthNear` / `depthFar` | Nearest / farthest plane Z. Drives perspective + fog. |
| `photoHeight` | World height of a plane; width follows the photo's aspect ratio. |
| `parallax` | How far the camera slides with the mouse. |
| `floatAmp` | Amplitude of the idle drift. |
| `hoverScale` | How much a hovered photo grows. |
| `cameraZ` | Camera distance from the field center. |

## Accessibility & performance

- Targets 60fps on desktop with 40 planes; `pixelRatio` is capped at 2.
- Responsive down to mobile (the nav hides under 600px; the name stays).
- Respects `prefers-reduced-motion: reduce`: drift and parallax turn off, hover still works.
- Textures load asynchronously — each photo appears the moment it's ready.

## Deploy on GitHub Pages

1. Push this repo to GitHub.
2. **Settings → Pages → Build and deployment → Source: Deploy from a branch**, pick your branch and
   `/ (root)`.
3. Open the published URL. All paths are relative, so no further config is needed.

## A note on the rendering approach

Malik's reel describes the field as `THREE.Points` + a custom shader
(`gl_PointSize = size * (300.0 / -mvPosition.z)`, with a `sampler2D textures[N]` indexed per
particle). This rebuild deliberately does **not** do that, for two reasons:

1. `THREE.Points` draws **square** sprites, which would distort/crop rectangular photos.
2. The reel's `texture2D(textures[index], …)` snippet, with a dynamic index from a `varying`, does
   **not compile** in WebGL1 (GLSL ES 1.00 forbids dynamic indexing of sampler arrays).

Instead, each photo is a **textured plane** sized to its real aspect ratio, which reproduces the
visual result faithfully while keeping photos correct. If you ever want the literal `Points`+shader
approach, the correct fix is a texture atlas with per-point UV offset/scale attributes.
