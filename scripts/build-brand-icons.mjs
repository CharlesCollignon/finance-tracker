/**
 * Renders the launcher artwork from the orb.
 *
 * The orb the apps show is a live thing — a glass shell with clouds turning
 * inside it, built from CSS on the web and from SVG and Reanimated on mobile.
 * A launcher icon can be neither live nor transparent: the OS draws it over a
 * wallpaper nobody chose, at a size where nothing moves anyway. So this is the
 * one place the orb is allowed to be a still, opaque render — the same shape
 * and the same palette, frozen mid-drift on the app's own dark ground.
 *
 * Run after changing the orb's palette or geometry, and commit the output:
 *
 *   node scripts/build-brand-icons.mjs
 *
 * `sharp` is not a declared dependency of either app — nothing ships this, it
 * is a build-time tool for an artefact that gets committed. It arrives in the
 * root `node_modules` with the toolchain; if it ever stops doing so, install
 * it as a root devDependency rather than wiring it into an app.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The app's ground, and the mark's own family. See `COLORS` in the mobile
 *  theme tokens and `--orb-c*` in the web stylesheet. */
const PLATE = "#0a0a10";
/**
 * The ground *inside* the ball, which is not the plate.
 *
 * Using the plate's near-neutral black in here cost the orb its colour: the
 * gaussian blur mixes the clouds into whatever they are suspended in, and
 * mixing gold into a blue-black yields the olive-grey a first cut of these
 * icons came out as. A warm brown-black keeps every blended pixel inside the
 * gold family.
 */
const CORE = "#17110a";
const C1 = "#fdf0cb";
const C2 = "#e9cd8b";
const C3 = "#5c4415";

/**
 * The orb, still.
 *
 * Drawn in a 100×100 box so the geometry can be copied straight from the
 * mobile component, then placed into whatever square the caller asks for.
 * `diameter` is the fraction of the canvas the ball occupies: 1 fills it
 * edge to edge, and the maskable and adaptive variants pass something
 * smaller so the OS can crop a circle or a squircle out of the result
 * without biting into the sphere.
 *
 * The glass is thicker here than on any live orb. Those sit on a screen with
 * a bloom behind them and can afford to be nearly clear; this one has a flat
 * plate behind it, so a clear shell would read as a smudge on the plate
 * rather than as a ball on it.
 */
function orbSvg({ size, diameter = 1, plate = false }) {
  const d = 100 * diameter;
  const o = (100 - d) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <defs>
    <radialGradient id="shell" cx="62%" cy="27%" r="70%">
      <stop offset="0" stop-color="${C1}" stop-opacity="0.4"/>
      <stop offset="0.4" stop-color="${C2}" stop-opacity="0.52"/>
      <stop offset="0.72" stop-color="${C2}" stop-opacity="0.62"/>
      <stop offset="1" stop-color="${C3}" stop-opacity="0.7"/>
    </radialGradient>
    <radialGradient id="cloudA"><stop offset="0" stop-color="${C1}" stop-opacity="0.95"/><stop offset="0.55" stop-color="${C1}" stop-opacity="0.5"/><stop offset="1" stop-color="${C1}" stop-opacity="0"/></radialGradient>
    <radialGradient id="cloudB"><stop offset="0" stop-color="${C2}" stop-opacity="1"/><stop offset="0.55" stop-color="${C2}" stop-opacity="0.55"/><stop offset="1" stop-color="${C2}" stop-opacity="0"/></radialGradient>
    <radialGradient id="cloudC"><stop offset="0" stop-color="${C3}" stop-opacity="0.55"/><stop offset="0.55" stop-color="${C3}" stop-opacity="0.24"/><stop offset="1" stop-color="${C3}" stop-opacity="0"/></radialGradient>
    <radialGradient id="cloudD"><stop offset="0" stop-color="${C2}" stop-opacity="0.72"/><stop offset="0.55" stop-color="${C2}" stop-opacity="0.34"/><stop offset="1" stop-color="${C2}" stop-opacity="0"/></radialGradient>
    <radialGradient id="spec"><stop offset="0" stop-color="#fff8dd" stop-opacity="0.8"/><stop offset="0.42" stop-color="#ffeec0" stop-opacity="0.24"/><stop offset="1" stop-color="#fffaeb" stop-opacity="0"/></radialGradient>
    <radialGradient id="spec2"><stop offset="0" stop-color="#fffae8" stop-opacity="0.34"/><stop offset="1" stop-color="#fffae8" stop-opacity="0"/></radialGradient>
    <radialGradient id="bounce"><stop offset="0" stop-color="#ffedc2" stop-opacity="0.4"/><stop offset="1" stop-color="#ffedc2" stop-opacity="0"/></radialGradient>
    <clipPath id="ball"><circle cx="50" cy="50" r="${d / 2}"/></clipPath>
    <filter id="soft"><feGaussianBlur stdDeviation="${7 * diameter}"/></filter>
  </defs>
  ${plate ? `<rect width="100" height="100" fill="${PLATE}"/>` : ""}
  <g clip-path="url(#ball)">
    <!-- The dark inside the glass. Without it the clouds have nothing to be
         suspended in and the ball looks like paint on the plate. -->
    <circle cx="50" cy="50" r="${d / 2}" fill="${CORE}"/>
    <g filter="url(#soft)">
      <ellipse cx="${o + 34 * diameter}" cy="${o + 32 * diameter}" rx="${30 * diameter}" ry="${23 * diameter}" fill="url(#cloudA)"/>
      <ellipse cx="${o + 70 * diameter}" cy="${o + 58 * diameter}" rx="${24 * diameter}" ry="${31 * diameter}" fill="url(#cloudB)"/>
      <ellipse cx="${o + 50 * diameter}" cy="${o + 76 * diameter}" rx="${36 * diameter}" ry="${20 * diameter}" fill="url(#cloudC)"/>
      <ellipse cx="${o + 28 * diameter}" cy="${o + 60 * diameter}" rx="${22 * diameter}" ry="${22 * diameter}" fill="url(#cloudD)"/>
    </g>
    <circle cx="50" cy="50" r="${d / 2}" fill="url(#shell)"/>
    <ellipse cx="${o + 42 * diameter}" cy="${o + 86 * diameter}" rx="${30 * diameter}" ry="${14 * diameter}" fill="url(#bounce)"/>
    <ellipse cx="${o + 63 * diameter}" cy="${o + 22 * diameter}" rx="${14 * diameter}" ry="${10 * diameter}" fill="url(#spec)"/>
    <ellipse cx="${o + 37 * diameter}" cy="${o + 71 * diameter}" rx="${7 * diameter}" ry="${6 * diameter}" fill="url(#spec2)"/>
  </g>
  <circle cx="50" cy="50" r="${d / 2 - 0.6 * diameter}" fill="none" stroke="#fff4d6" stroke-opacity="0.3" stroke-width="${1.2 * diameter}"/>
</svg>`;
}

/** The Android monochrome layer: a silhouette, which is all the OS keeps. */
function monochromeSvg({ size, diameter }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="${(100 * diameter) / 2}" fill="#ffffff"/>
</svg>`;
}

/**
 * The targets.
 *
 * `opaque` flattens the alpha onto the plate — the square icons keep the
 * three channels they shipped with, and iOS rejects an icon with alpha
 * outright. The two that stay transparent are the ones drawn over a ground
 * something else already chose: the splash, whose colour is set in `app.json`,
 * and the Android adaptive foreground, which is composited over its own
 * background layer.
 */
const TARGETS = [
  // The mobile app.
  {
    path: "apps/mobile/assets/images/icon.png",
    size: 1024,
    opaque: true,
    svg: orbSvg,
    diameter: 0.86,
    plate: true,
  },
  {
    path: "apps/mobile/assets/images/favicon.png",
    size: 64,
    opaque: true,
    svg: orbSvg,
    diameter: 0.9,
    plate: true,
  },
  {
    path: "apps/mobile/assets/images/splash-icon.png",
    size: 512,
    svg: orbSvg,
    diameter: 1,
  },
  // Android's adaptive layers. The foreground is cropped to a shape the
  // launcher picks, and only the middle ~66% of it is guaranteed to survive.
  // There is no background layer to draw: `app.json` paints that plate with a
  // flat colour, which is all a flat colour needs.
  {
    path: "apps/mobile/assets/images/android-icon-foreground.png",
    size: 1024,
    svg: orbSvg,
    diameter: 0.62,
  },
  {
    path: "apps/mobile/assets/images/android-icon-monochrome.png",
    size: 432,
    svg: monochromeSvg,
    diameter: 0.62,
  },
  // The web app: tab icon, iOS home screen, and the manifest's pair.
  {
    path: "apps/web/app/icon.png",
    size: 512,
    opaque: true,
    svg: orbSvg,
    diameter: 0.88,
    plate: true,
  },
  {
    path: "apps/web/app/apple-icon.png",
    size: 180,
    opaque: true,
    svg: orbSvg,
    diameter: 0.88,
    plate: true,
  },
  {
    path: "apps/web/public/icon-192.png",
    size: 192,
    opaque: true,
    svg: orbSvg,
    diameter: 0.88,
    plate: true,
  },
  {
    path: "apps/web/public/icon-512.png",
    size: 512,
    opaque: true,
    svg: orbSvg,
    diameter: 0.88,
    plate: true,
  },
  // Maskable is its own file rather than the 512 doing both jobs. A maskable
  // icon is cropped to whatever shape the platform likes, so it has to hold
  // the mark well inside its edges — and an "any" icon padded that far in
  // just looks small everywhere it is not cropped.
  {
    path: "apps/web/public/icon-maskable-512.png",
    size: 512,
    opaque: true,
    svg: orbSvg,
    diameter: 0.6,
    plate: true,
  },
];

for (const { path, size, opaque, svg, diameter, plate } of TARGETS) {
  const markup = svg({ size, diameter, plate });
  let img = sharp(Buffer.from(markup), { density: 384 }).resize(size, size);
  if (opaque) img = img.flatten({ background: PLATE });
  const out = join(root, path);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, await img.png().toBuffer());
  console.log(`${path}  ${size}×${size}${opaque ? "" : "  (alpha)"}`);
}
