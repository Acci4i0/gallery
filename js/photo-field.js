/**
 * Photo Field — a scatter of photos floating in 3D on white.
 * Rebuild study of Malik Kotb's portfolio (malik.url). See CREDITS.md.
 *
 * Rendering: one textured plane per photo (PlaneGeometry + MeshBasicMaterial),
 * scaled to the texture's real aspect ratio so nothing is cropped to a square.
 * Depth reads through perspective + a white fog that dissolves the far photos.
 *
 * Navigation (1:1 with the reference recording): the field is still at rest and
 * only moves when you drag it. Drag pans the field (grab-and-pull); on release it
 * glides on with damped momentum and settles back to a stop. A continuous,
 * unbounded `nav` offset plus per-photo toroidal wrapping makes the field endless,
 * so you never reach an edge; a soft edge fade hides the wrap seam.
 */

import { MEDIA } from './media.js';

/* The single knob panel. Tune the field here, never the logic below. */
const FIELD = {
  count: 49, // approx planes (rounded to fill a jittered grid; a photo repeats)
  spreadX: 95, // half-width of the wrap cell on X (world units)
  spreadY: 95, // half-height of the wrap cell on Y (world units)
  depthNear: -20, // nearest plane Z (modest depth → fairly uniform sizes)
  depthFar: -75, // farthest plane Z (gentle size falloff, like the reference)
  photoHeight: 12, // world height of a plane; width follows the aspect ratio
  hoverScale: 1.5, // how much a hovered photo grows
  cameraZ: 60, // camera distance from the field center
  dragSpeed: 0.12, // world units travelled per pixel dragged
  inertiaDamping: 0.95, // how fast a drag-throw glide decays (per frame) → ~1.5s
  edgeFadeStart: 0.8, // fraction of the cell where photos fade out to hide wraps
  footprint: 1.6, // photo width budget (× photoHeight) used to keep cells non-overlapping
  seed: null, // RNG seed for reproducible layouts (null → fully random)
};

const WHITE = 0xffffff;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const random = makeRandom(FIELD.seed);

/* A jittered grid of cells gives each photo its own slot so they don't overlap,
   while the per-cell jitter keeps the scatter looking organic. The grid tiles
   the wrap cell exactly, so it stays seamless and endless when wrapped. */
const GRID = buildGrid();
const PLANES = GRID.cols * GRID.rows;

const stage = buildScene();
const field = { group: new THREE.Group(), photos: [] };
const pointer = createPointerState();

main();

function main() {
  stage.scene.add(field.group);
  bindEvents();
  buildPhotoField(MEDIA);
  startRenderLoop();
}

/* -------------------------------------------------------------------- scene */

function buildScene() {
  const container = document.getElementById('app');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(WHITE);
  scene.fog = buildFog();

  const camera = new THREE.PerspectiveCamera(50, aspect(), 0.1, 2000);
  camera.position.set(0, 0, FIELD.cameraZ);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.setPixelRatio(cappedPixelRatio());
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  return { scene, camera, renderer };
}

/* Fog bites only in the back half: near/mid photos stay crisp, far ones melt
   into white — the "infinite field" feel. Distances are measured from camera. */
function buildFog() {
  const camToNear = FIELD.cameraZ - FIELD.depthNear;
  const camToFar = FIELD.cameraZ - FIELD.depthFar;
  return new THREE.Fog(WHITE, (camToNear + camToFar) / 2, camToFar + 10);
}

/* -------------------------------------------------------------------- field */

/* Load each unique photo once, then spawn the planes that share that texture
   (count > photos means a photo repeats). Each plane appears as its texture
   arrives, so one slow photo never blocks the rest. */
function buildPhotoField(media) {
  if (media.length === 0) return;

  const loader = new THREE.TextureLoader();
  media.forEach((source, offset) => {
    loader.load(
      source,
      (texture) => spawnPlanesFor(texture, offset, media.length),
      undefined,
      () => console.warn('Could not load texture:', source)
    );
  });
}

function spawnPlanesFor(texture, offset, stride) {
  prepareTexture(texture);
  const geometry = planeFor(texture); // shared by every plane using this photo
  for (let index = offset; index < PLANES; index += stride) {
    addPhoto(geometry, texture, index);
  }
}

function addPhoto(geometry, texture, index) {
  const photo = new THREE.Mesh(geometry, materialFor(texture));
  photo.userData.reveal = 0; // entrance progress; combined with edge fade per frame
  placeOnGrid(photo, index);

  field.group.add(photo);
  field.photos.push(photo);
  revealPhoto(photo, index);
  hideSpinner();
}

function planeFor(texture) {
  const ratio = textureAspect(texture);
  return new THREE.PlaneGeometry(FIELD.photoHeight * ratio, FIELD.photoHeight);
}

function materialFor(texture) {
  return new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0, fog: true });
}

/* Drop the photo into its grid cell with a little jitter (so no two overlap) and
   a random depth. Base position lives in one wrap cell; the field wraps it. */
function placeOnGrid(photo, index) {
  const col = index % GRID.cols;
  const row = Math.floor(index / GRID.cols);
  photo.position.set(
    -FIELD.spreadX + (col + 0.5) * GRID.cellW + randomBetween(-GRID.jitter, GRID.jitter),
    -FIELD.spreadY + (row + 0.5) * GRID.cellH + randomBetween(-GRID.jitter, GRID.jitter),
    randomBetween(FIELD.depthFar, FIELD.depthNear)
  );
  photo.userData.basePosition = photo.position.clone();
}

/* Staggered fade + scale-in so the field assembles instead of popping in. */
function revealPhoto(photo, index) {
  if (reducedMotion) {
    photo.userData.reveal = 1;
    return;
  }
  const delay = (index / PLANES) * 0.8;
  photo.scale.setScalar(0.6);
  gsap.to(photo.userData, { reveal: 1, duration: 1.0, delay, ease: 'power2.out' });
  gsap.to(photo.scale, { x: 1, y: 1, z: 1, duration: 1.1, delay, ease: 'power3.out' });
}

/* ----------------------------------------------------------------- controls */

function createPointerState() {
  return {
    mouse: new THREE.Vector2(0, 0), // normalized [-1, 1]; for the hover raycaster
    nav: new THREE.Vector2(0, 0), // continuous, unbounded travel offset
    navVelocity: new THREE.Vector2(0, 0), // drag-throw velocity, decays after release
    dragging: false,
    pointerId: null,
    lastDrag: new THREE.Vector2(0, 0),
    hovered: null,
    raycaster: new THREE.Raycaster(),
  };
}

function bindEvents() {
  const dom = stage.renderer.domElement;
  window.addEventListener('mousemove', onPointerMove);
  dom.addEventListener('pointerdown', onDragStart);
  window.addEventListener('pointermove', onDragMove);
  window.addEventListener('pointerup', onDragEnd);
  window.addEventListener('resize', onResize);
}

function onPointerMove(event) {
  pointer.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.mouse.y = -((event.clientY / window.innerHeight) * 2 - 1);
}

function onDragStart(event) {
  pointer.dragging = true;
  pointer.pointerId = event.pointerId;
  pointer.lastDrag.set(event.clientX, event.clientY);
  pointer.navVelocity.set(0, 0);
  stage.renderer.domElement.style.cursor = 'grabbing';
  stage.renderer.domElement.setPointerCapture(event.pointerId);
}

/* Grab-and-pull: the field follows the cursor. The last step is kept as the
   throw velocity for release inertia. */
function onDragMove(event) {
  if (!pointer.dragging) return;
  const dx = event.clientX - pointer.lastDrag.x;
  const dy = event.clientY - pointer.lastDrag.y;
  pointer.lastDrag.set(event.clientX, event.clientY);

  const stepX = -dx * FIELD.dragSpeed;
  const stepY = dy * FIELD.dragSpeed;
  pointer.nav.x += stepX;
  pointer.nav.y += stepY;
  pointer.navVelocity.set(stepX, stepY);
}

function onDragEnd() {
  if (!pointer.dragging) return;
  pointer.dragging = false;
  stage.renderer.domElement.style.cursor = pointer.hovered ? 'pointer' : 'default';
  try {
    if (pointer.pointerId != null) stage.renderer.domElement.releasePointerCapture(pointer.pointerId);
  } catch (error) {
    /* pointer was already released */
  }
}

function onResize() {
  stage.camera.aspect = aspect();
  stage.camera.updateProjectionMatrix();
  stage.renderer.setPixelRatio(cappedPixelRatio());
  stage.renderer.setSize(window.innerWidth, window.innerHeight);
}

/* --------------------------------------------------------------- main loop */

function startRenderLoop() {
  stage.renderer.setAnimationLoop(() => {
    coastNavigation();
    placeField();
    updateHover();
    stage.renderer.render(stage.scene, stage.camera);
  });
}

/* Off the hand, a drag-throw keeps gliding and decays to a stop (matching the
   recording's swipe momentum). With no throw, the field is perfectly still. */
function coastNavigation() {
  if (pointer.dragging) return;
  pointer.nav.add(pointer.navVelocity);
  pointer.navVelocity.multiplyScalar(FIELD.inertiaDamping);
}

/* Place every photo this frame: wrap it around the view by the travel offset
   and fade it near the cell edge so the wrap seam never shows. */
function placeField() {
  const cellX = FIELD.spreadX * 2;
  const cellY = FIELD.spreadY * 2;
  for (const photo of field.photos) {
    const base = photo.userData.basePosition;
    const x = wrapAround(base.x - pointer.nav.x, cellX);
    const y = wrapAround(base.y - pointer.nav.y, cellY);
    photo.position.x = x;
    photo.position.y = y;
    photo.material.opacity = photo.userData.reveal * edgeFade(x, y);
  }
}

/* One hovered photo at a time: raycast, grow the hit, shrink whoever lost focus. */
function updateHover() {
  pointer.raycaster.setFromCamera(pointer.mouse, stage.camera);
  const hits = pointer.raycaster.intersectObjects(field.photos, false);
  const hit = hits.length > 0 ? hits[0].object : null;
  if (hit === pointer.hovered) return;

  if (pointer.hovered) scalePhoto(pointer.hovered, 1);
  if (hit) scalePhoto(hit, FIELD.hoverScale);
  pointer.hovered = hit;
  if (!pointer.dragging) {
    stage.renderer.domElement.style.cursor = hit ? 'pointer' : 'default';
  }
}

function scalePhoto(photo, value) {
  gsap.to(photo.scale, { x: value, y: value, z: value, duration: 0.4, ease: 'power3.out', overwrite: 'auto' });
}

/* ------------------------------------------------------------------ helpers */

/* Mipmaps + anisotropy keep photos crisp when minified (a large texture drawn
   small would otherwise alias into grain). Mipmaps are only enabled on WebGL2,
   where non-power-of-two textures keep full resolution; on a WebGL1 fallback
   they'd force a downscale to a power of two, so we skip them there. */
function prepareTexture(texture) {
  const caps = stage.renderer.capabilities;
  texture.encoding = THREE.sRGBEncoding;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = caps.isWebGL2 ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  texture.generateMipmaps = caps.isWebGL2;
  texture.anisotropy = caps.getMaxAnisotropy();
}

function textureAspect(texture) {
  const image = texture.image;
  if (image && image.width && image.height) return image.width / image.height;
  return 1;
}

function hideSpinner() {
  const spinner = document.getElementById('spinner');
  if (spinner) spinner.hidden = true;
}

/* Map a value into [-size/2, size/2): the toroidal wrap that makes the field
   endless. Handles negative values correctly. */
function wrapAround(value, size) {
  const half = size / 2;
  return (((value + half) % size) + size) % size - half;
}

/* 1 in the middle of the cell, easing to 0 at the edge so wraps fade out. */
function edgeFade(x, y) {
  const edge = Math.max(Math.abs(x) / FIELD.spreadX, Math.abs(y) / FIELD.spreadY);
  const t = (edge - FIELD.edgeFadeStart) / (1 - FIELD.edgeFadeStart);
  return 1 - clamp01(t);
}

/* Lay out a grid that tiles the wrap cell. The jitter is the slack left in each
   cell after reserving the photo's footprint, so jittered neighbours still can't
   overlap. count is rounded up to fill cols × rows. */
function buildGrid() {
  const cols = Math.max(1, Math.round(Math.sqrt(FIELD.count * (FIELD.spreadX / FIELD.spreadY))));
  const rows = Math.max(1, Math.ceil(FIELD.count / cols));
  const cellW = (FIELD.spreadX * 2) / cols;
  const cellH = (FIELD.spreadY * 2) / rows;
  const footprint = FIELD.photoHeight * FIELD.footprint;
  const jitter = Math.max(0, (Math.min(cellW, cellH) - footprint) / 2);
  return { cols, rows, cellW, cellH, jitter };
}

function aspect() {
  return window.innerWidth / window.innerHeight;
}

function cappedPixelRatio() {
  return Math.min(window.devicePixelRatio, 2);
}

function randomBetween(min, max) {
  return min + random() * (max - min);
}

function clamp01(value) {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/* Seedable RNG (mulberry32). With no seed, defer to Math.random. */
function makeRandom(seed) {
  if (seed == null) return Math.random;
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
