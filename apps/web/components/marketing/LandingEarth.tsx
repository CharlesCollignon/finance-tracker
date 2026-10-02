"use client";

import { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * The hero's horizon: the Earth from orbit, Europe at dusk under a field of
 * stars and a nebula, drawn in WebGL.
 *
 * Adapted from "Earth Blaze" by Legacy on 21st.dev. The renderer below — the
 * shaders for the planet, its atmosphere, the nebula and the stars, and the
 * light that follows the pointer along the rim — is theirs, kept as written
 * but for what is listed here:
 *
 * - The texture is served from this site (`/marketing/`, resized to the
 *   4096px the renderer uses at most) rather than from 21st's CDN, so a
 *   visit to the landing page sends nobody's address to a third party.
 * - It is decoration here: hidden from screen readers and out of the tab
 *   order, with the keyboard controls and English instructions taken out.
 *   The pointer still moves the light; holding and releasing still wakes the
 *   aurora.
 * - The wrapper follows this codebase's React rules: no ref written while
 *   rendering, and an effect that depends on what it reads.
 * - The planet sits where the landing's orb horizon sat — the same circle,
 *   stepping with the screen the same way (`horizonCircle`) — rather than on
 *   the original's diagonal, and the light rests low on the right of the
 *   rim, in the distant sun, clear of the headline.
 * - The stars drift: slowly, each on its own, nearer ones faster, so the sky
 *   sets behind the rim over minutes. The original's held still unless the
 *   pointer moved them.
 * - The light follows the pointer partway and slowly (`LIGHT_FOLLOW`), and
 *   the pointer pulls the sky half as far.
 * - An aurora can stand along the rim (`aurora`), its curtains drifting,
 *   rather than only after a hold and release.
 * - A black hole sits just behind the horizon, the rim cutting off the foot
 *   of its shadow and one end of its disk, which turns slowly, the nebula
 *   and the starlight bending round it (`distantHole`). It is ours, not the
 *   original's, and does not follow the pointer.
 * - A distant sun is setting on the rim to the right of the headline, warm,
 *   a third of it above the horizon and the light resting in it
 *   (`distantSun`); ours too, and fixed.
 *
 * Imagery: NASA Blue Marble Next Generation, by Reto Stöckli (NASA Earth
 * Observatory), used without endorsement; credited in the landing footer.
 *
 * Still under reduced motion, from the operating system's setting, and a CSS
 * gradient stands in wherever WebGL is unavailable.
 */

/** NASA Blue Marble, January 2004, cloud-free topography, 4096×2048. */
const EARTH_TEXTURE = "/marketing/earth-blue-marble.webp";

interface LandingEarthProps {
  className?: string;
  /** Deterministic star field. Clamped to 0–5400. */
  starCount?: number;
  /** Nebula exposure, 0–3. */
  galaxyBrightness?: number;
  /** Earth exposure, 0–4. */
  surfaceBrightness?: number;
  /** Sun glow, atmospheric rim and Earth illumination, 0–3. */
  illumination?: number;
  auroraEnabled?: boolean;
  /**
   * A standing aurora along the rim, 0–1: at 1, as bright as the curtains of
   * the original's aurora preview, without the preview's bloom over the sun,
   * the nebula and the land. 0 leaves the aurora to holding and releasing.
   */
  aurora?: number;
  /** Whether the pointer moves the light along the rim. */
  interactive?: boolean;
  textureUrl?: string;
  /** Omit to follow the operating system preference. */
  reducedMotion?: boolean;
}

type Color = [number, number, number, number];
type Options = {
  starCount: number;
  galaxyBrightness: number;
  surfaceBrightness: number;
  illumination: number;
  auroraPreview: boolean;
  auroraEnabled: boolean;
  aurora: number;
  interactive: boolean;
  textureUrl: string;
  reducedMotion?: boolean;
  auroraColor: Color;
  backgroundColor: Color;
};
type Uniforms = Record<string, WebGLUniformLocation | null>;
type Geometry = {
  center: [number, number];
  radius: number;
  low: number;
  high: number;
  rest: number;
  /** The black hole: its centre, its shadow's radius, its disk's tilt. */
  hole: [number, number, number, number];
  /** The distant sun: its centre, and its disk's radius. */
  sun: [number, number, number];
};
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));
const finite = (n: number, fallback: number, max: number) =>
  clamp(Number.isFinite(n) ? n : fallback, 0, max);
/** No tint: the original aurora and nebula palette. */
const UNTINTED: Color = [0, 0, 0, 0];

export function LandingEarth({
  className,
  starCount = 1800,
  galaxyBrightness = 1,
  surfaceBrightness = 1,
  illumination = 1,
  auroraEnabled = true,
  aurora = 0,
  interactive = true,
  textureUrl = EARTH_TEXTURE,
  reducedMotion,
}: LandingEarthProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const fallback = useRef<HTMLDivElement>(null);
  const renderer = useRef<ReturnType<typeof createRenderer> | null>(null);

  const options = useMemo<Options>(
    () => ({
      starCount: Math.round(finite(starCount, 1800, 5400)),
      galaxyBrightness: finite(galaxyBrightness, 1, 3),
      surfaceBrightness: finite(surfaceBrightness, 1, 4),
      illumination: finite(illumination, 1, 3),
      auroraColor: UNTINTED,
      backgroundColor: UNTINTED,
      auroraPreview: false,
      auroraEnabled,
      aurora: finite(aurora, 0, 1),
      interactive,
      textureUrl,
      reducedMotion,
    }),
    [
      starCount,
      galaxyBrightness,
      surfaceBrightness,
      illumination,
      auroraEnabled,
      aurora,
      interactive,
      textureUrl,
      reducedMotion,
    ],
  );
  // What the renderer starts from; later changes reach it through `update`.
  const initial = useRef(options);

  useEffect(() => {
    if (!canvas.current || !fallback.current) {
      return;
    }
    const instance = createRenderer(
      canvas.current,
      fallback.current,
      initial.current,
    );
    renderer.current = instance;
    return () => {
      instance.dispose();
      renderer.current = null;
    };
  }, []);

  useEffect(() => {
    renderer.current?.update(options);
  }, [options]);

  return (
    <div
      className={cn(
        "absolute inset-0 isolate overflow-hidden bg-black",
        className,
      )}
      aria-hidden
    >
      <div
        ref={fallback}
        className="absolute inset-0 overflow-hidden"
        style={{
          background:
            "radial-gradient(ellipse at 32% 38%, #312034 0%, #101421 22%, #020308 52%, #000 78%)",
        }}
      >
        <div
          className="absolute rounded-[50%] bg-black"
          style={{
            width: "180%",
            height: "220%",
            left: "19%",
            top: "18%",
            boxShadow: "-2px -2px 3px #aa7c79, -8px -8px 38px #62406166",
            transform: "rotate(-28deg)",
          }}
        />
      </div>
      <canvas
        ref={canvas}
        tabIndex={-1}
        className="absolute inset-0 block h-full w-full"
        style={{ touchAction: interactive ? "pan-y" : "auto" }}
      />
    </div>
  );
}

const vertex = `
    attribute vec2 position;
    void main() { gl_Position = vec4(position, 0., 1.); }
  `;
const fragment = `
    precision highp float;
    uniform vec2 resolution;
    uniform vec2 center;
    uniform float radius;
    uniform float angle;
    uniform float reveal;
    uniform float galaxyBrightness;
    uniform float surfaceBrightness;
    uniform vec4 auroraColor;
    uniform vec4 backgroundColor;
    uniform float illumination;
    uniform float auroraPreview;
    uniform float standingAurora;
    uniform float viewAngle;
    uniform float clock;
    uniform float charge;
    uniform float pulse;
    uniform float pulseAngle;
    uniform float still;
    uniform vec2 drift;
    uniform vec4 hole;
    uniform vec3 farSun;
    uniform sampler2D earth;
    uniform sampler2D cosmos;
    const float PI = 3.141592653589793;

    float gauss(float x, float width) { return exp(-x * x / (width * width)); }
    float grain(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(.06711056, .00583715)))); }
    mat2 rotate(float a) { return mat2(cos(a), -sin(a), sin(a), cos(a)); }

    vec3 orientGlobe(vec2 xy) {
      vec3 n = vec3(xy.x, -xy.y, sqrt(max(0., 1. - dot(xy, xy))));
      // Keep Europe in the illuminated region on both wide and portrait screens.
      n.xy = rotate(-2.30267 - viewAngle) * n.xy;
      n.xz = rotate(2.70) * n.xz;
      n.xy = rotate(-.08) * n.xy;
      return n;
    }
    vec2 geography(vec3 n) {
      return vec2(atan(-n.z, n.x), asin(clamp(n.y, -1., 1.)));
    }
    vec3 recolor(vec3 source, vec4 tint) {
      return mix(source, tint.rgb * max(source.r, max(source.g, source.b)), tint.a);
    }

    // A black hole beyond the planet, in units of its shadow's radius: the
    // shadow, the thin ring of light bent round it, the far half of its disk
    // lensed into an arc over the top, and the near half across the front,
    // turning slowly, its approaching side — the right, the end that clears
    // the horizon — the brighter. Fixed in the sky (it does not follow the
    // pointer) and a little paled by the distance. Returns its light, and
    // what is left of the sky behind it; the planet hides both below the rim.
    vec4 distantHole(vec2 p, float pixel) {
      vec2 b = rotate(hole.w) * (p - hole.xy) / hole.z;
      float r = length(b);
      if (r > 9.) return vec4(0., 0., 0., 1.);
      float soft = max(.06, pixel / hole.z * 1.5);
      float shadow = smoothstep(1. - soft, 1. + soft, r);
      vec2 d = vec2(b.x, b.y / .2);
      float rd = max(length(d), .001);
      float turn = atan(d.y, d.x);
      float spin = clock * .08;
      float swirl = .72 + .18 * sin(turn * 2. + log(rd) * 6. - spin * 2.) + .10 * sin(turn * 5. - log(rd) * 9. - spin * 5.);
      float profile = smoothstep(1.35, 1.9, rd) * exp(-max(rd - 1.9, 0.) / 1.3);
      profile *= mix(shadow, 1., step(0., b.y));
      float approach = d.x / rd;
      vec3 hot = mix(vec3(.92, .46, .22), vec3(1., .86, .70), min(1., exp(-(rd - 1.6) / 1.1)));
      vec3 light = mix(hot, vec3(.80, .86, 1.), max(approach, 0.) * .25) * profile * swirl * (1. + .6 * approach) * .9;
      float up = -b.y / max(r, .001);
      float arc = exp(-pow((r - 1.22) / .22, 2.)) * (.3 + .7 * smoothstep(-.6, .9, up)) * shadow;
      light += vec3(1., .78, .58) * arc * .95 * (1. + .35 * b.x / max(r, .001));
      light += vec3(1., .90, .80) * exp(-pow((r - 1.04) / max(.05, soft), 2.)) * shadow * .5;
      light += vec3(.10, .06, .07) * exp(-r * r / 30.);
      light = mix(light, vec3(dot(light, vec3(.2126, .7152, .0722))), .2) * .4;
      return vec4(light, shadow);
    }

    // A distant sun: a warm disk, oranger toward its edge, in a soft glow
    // that breathes slowly. Not bright: the centre of the disk is three
    // quarters of full white. The glow is measured from the disk's edge in
    // the hero's height rather than in the disk's radius, so a large sun does
    // not flood the sky. Fixed in the sky; the planet hides most of it.
    vec3 distantSun(vec2 p, float pixel) {
      float dist = length(p - farSun.xy);
      float beyond = max(dist - farSun.z, 0.);
      if (beyond > .9) return vec3(0.);
      float q = dist / farSun.z;
      float edge = pixel / farSun.z;
      float disk = 1. - smoothstep(1. - edge, 1. + edge, q);
      vec3 face = mix(vec3(1., .50, .16), vec3(1., .80, .47), pow(max(0., 1. - q * q), .4));
      float breath = 1. + .06 * sin(clock * .5);
      vec3 glow = vec3(1., .56, .22) * (.30 * exp(-beyond / (.012 + farSun.z * .15)) + .14 * exp(-beyond / (.05 + farSun.z * .4)) + .045 * exp(-beyond / (.18 + farSun.z))) * breath;
      return face * disk * .75 + glow * (1. - disk);
    }

    void main() {
      vec2 p = vec2(gl_FragCoord.x, resolution.y - gl_FragCoord.y) / resolution.y;
      vec2 q = p - center;
      float distanceToCenter = length(q);
      float d = distanceToCenter - radius;
      float pixel = 1. / resolution.y;
      vec2 radial = vec2(cos(angle), sin(angle));
      vec2 tangent = vec2(-radial.y, radial.x);
      vec2 sun = center + radial * (radius - .007);
      vec2 delta = p - sun;
      float along = dot(delta, tangent);
      float across = dot(delta, radial);
      float angleDistance = acos(clamp(dot(q / max(distanceToCenter, .0001), radial), -1., 1.)) * radius;
      float space = smoothstep(-pixel, pixel, d);
      float inside = 1. - space;
      float verticalFade = smoothstep(.005, .13, p.y) * (1. - smoothstep(.86, 1.02, p.y));
      float rimLocal = gauss(angleDistance, .34);

      // Holding the light bends the distant nebula, while the planet stays still.
      float event = max(pulse, 0.);
      float bloom = smoothstep(0., .32, event) * (1. - smoothstep(1.4, 4.8, event)) * step(0., pulse);
      bloom = max(max(bloom, charge * still * .65), auroraPreview * .75);
      vec2 sky = p - drift * .0035;
      vec2 fromHole = p - hole.xy;
      float einstein = hole.z * 1.7;
      sky -= fromHole * einstein * einstein / max(dot(fromHole, fromHole), hole.z * hole.z);
      vec2 lens = sky - sun;
      float bend = charge * exp(-dot(lens, lens) / .32) * (1. - still);
      sky = sun + rotate(-bend * .46) * lens / (1. - bend * .20);
      vec2 skyUV = vec2(sky.x / (resolution.x / resolution.y), 1. - sky.y);
      vec3 color = recolor(texture2D(cosmos, skyUV).rgb, backgroundColor) * galaxyBrightness * space * (1. + charge * .45 + bloom * .5);
      vec4 farHole = distantHole(p, pixel);
      color = color * farHole.a + farHole.rgb * space;
      color += distantSun(p, pixel) * space;

      // Scattering stays on the sky side of the occluding planet.
      vec3 halo = vec3(.105, .026, .065) * gauss(along, .23) * gauss(across, .11);
      halo += vec3(.21, .066, .072) * gauss(along, .12) * gauss(across, .061);
      halo += vec3(.29, .16, .125) * gauss(along, .057) * gauss(across, .033);
      halo += vec3(.57, .48, .40) * gauss(along, .025) * gauss(across, .020);
      color += halo * illumination * space * (1. + charge * 1.4 + bloom * .65);

      // A thin cool atmosphere transitions to warm white beside the hidden sun.
      float line = gauss(d, max(.00042, pixel * .66));
      vec3 rim = mix(vec3(.105, .135, .18), vec3(.85, .64, .48), rimLocal);
      color += rim * illumination * line * verticalFade;
      color += vec3(.20, .078, .06) * illumination * gauss(d, .003) * rimLocal * verticalFade;
      color += vec3(.034, .057, .092) * illumination * exp(-max(d, 0.) / .007) * space * verticalFade * (.2 + .8 * rimLocal);
      // The atmosphere catches the distant sun where it sets.
      float bySun = gauss(length(p - farSun.xy), farSun.z * 2.5 + .05);
      color += vec3(1., .62, .32) * line * bySun * .7 * verticalFade;
      color += vec3(.45, .20, .07) * gauss(d, .004) * bySun * .35 * verticalFade;

      // A released solar pulse travels along the limb and awakens auroral curtains.
      vec2 eventRadial = vec2(cos(pulseAngle), sin(pulseAngle));
      vec2 eventSun = center + eventRadial * (radius - .007);
      float eventDistance = acos(clamp(dot(q / max(distanceToCenter, .0001), eventRadial), -1., 1.)) * radius;
      float sweep = gauss(eventDistance - event * .31, .14);
      sweep = max(sweep, auroraPreview * .8);
      float curtainPhase = atan(q.y, q.x);
      float pleats = .5 + .5 * sin(curtainPhase * 185. + 3. * sin(curtainPhase * 37.) + clock * .23);
      float ceiling = .021 + .020 * sin(curtainPhase * 23. + clock * .11);
      float curtain = exp(-abs(d - ceiling) / .025) * (.25 + .75 * pleats);
      vec3 aurora = mix(vec3(.065, .54, .40), vec3(.36, .13, .59), .5 + .5 * sin(curtainPhase * 12.));
      // The standing aurora is a floor under both, as bright at 1 as the
      // preview's curtains, with none of the preview's bloom.
      color += recolor(aurora, auroraColor) * curtain * max(bloom * (.20 + sweep * .70), standingAurora * .57) * verticalFade;
      color += recolor(vec3(.22, .55, .63), auroraColor) * gauss(d, .0025) * max(sweep * bloom, standingAurora * .6) * verticalFade;

      float waveRadius = .025 + event * .32;
      float wave = gauss(length(p - eventSun) - waveRadius, .010 + event * .004);
      color += recolor(mix(vec3(.20, .36, .57), vec3(.36, .16, .33), .5 + .5 * sin(atan(delta.y, delta.x) * 3.)), auroraColor) * wave * bloom * .25 * space * (1. - still);

      if (d < 0.) {
        vec3 normal = orientGlobe(q / radius);
        vec2 geo = geography(normal);
        vec2 uv = vec2(.5) + geo / vec2(2. * PI, PI);
        vec3 tex = texture2D(earth, uv).rgb;
        float depth = -d;
        float grazing = smoothstep(.002, .033, depth) * exp(-depth / .19);
        float pool = max(gauss(angleDistance, .37), bloom * gauss(eventDistance, .65)) * grazing;
        vec3 surface = mix(tex, vec3(dot(tex, vec3(.2126, .7152, .0722))), .32);
        surface *= vec3(.61, .74, 1.);
        color += surface * pool * (.045 + reveal * .24 + bloom * .20 + charge * .045) * inside * surfaceBrightness * illumination;
        color += vec3(.010, .018, .032) * pool * (reveal + bloom) * inside * surfaceBrightness * illumination;
      }

      // One static sub-byte dither prevents bands without making black space noisy.
      float light = max(color.r, max(color.g, color.b));
      color += (grain(gl_FragCoord.xy) - .5) / 255. * smoothstep(.001, .015, light);
      gl_FragColor = vec4(clamp(color, 0., 1.), 1.);
    }
  `;

// Bake intricate nebular dust once. The animation then samples one texture.
const nebulaFragment = `
    precision highp float;
    uniform vec2 resolution;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
      return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y);
    }
    float fbm(vec2 p) {
      float f = 0., a = .5;
      for (int i = 0; i < 6; i++) { f += a * noise(p); p = mat2(.8, -.6, .6, .8) * p * 2.07 + 17.3; a *= .5; }
      return f;
    }
    void main() {
      vec2 uv = vec2(gl_FragCoord.x / resolution.x, 1. - gl_FragCoord.y / resolution.y);
      vec2 p = uv * vec2(2.1, 1.);
      vec2 warp = vec2(fbm(p * 3.1), fbm(p * 3.1 + 9.7));
      float gas = fbm(p * 7. + warp * 4.);
      float lace = fbm(p * 23. + warp * 7.);
      float rift = abs(uv.y - (.58 - uv.x * .65 + .065 * sin(uv.x * 7.)) + (gas - .5) * .19);
      float band = exp(-pow(rift / .15, 2.));
      float dust = smoothstep(.28, .68, fbm(p * 11. + warp * 5. + 30.));
      float clouds = pow(gas, 2.3) * (.28 + lace * 1.1) * band;
      vec3 cold = mix(vec3(.018, .13, .26), vec3(.28, .045, .16), smoothstep(.14, .80, warp.x));
      cold = mix(cold, vec3(.022, .22, .18), smoothstep(.47, .66, warp.y) * .65);
      vec3 col = cold * clouds * (1. - dust * .82) * 2.4;
      col += vec3(.08, .10, .15) * pow(lace, 4.) * band * .50;
      col += vec3(.005, .007, .014) * pow(fbm(p * 4. + 80.), 2.);
      float speck = pow(hash(gl_FragCoord.xy), 34.) * band * .029;
      col += vec3(.7, .8, 1.) * speck;
      gl_FragColor = vec4(col, 1.);
    }
  `;

const starVertex = `
    precision highp float;
    attribute vec4 star;
    attribute float tail;
    uniform vec2 resolution;
    uniform vec2 center;
    uniform vec2 drift;
    uniform vec4 hole;
    uniform float radius;
    uniform float angle;
    uniform float charge;
    uniform float clock;
    uniform float pulse;
    uniform float pulseAngle;
    uniform float still;
    varying vec3 tint;
    varying float alpha;
    varying float sharp;
    varying vec2 location;
    mat2 rotate(float a) { return mat2(cos(a), -sin(a), sin(a), cos(a)); }
    void main() {
      // Each star drifts left and a little down on its own, the brighter
      // (nearer) ones faster: the parallax of depth, slow enough that the
      // nearest take minutes to cross the sky and the farthest half an hour.
      // Wrapped, so the field never empties, and faded across the seam.
      vec2 s = fract(star.xy + vec2(-1., .25) * clock * (.0005 + star.w * .0028) * (1. - still));
      vec2 p = s * vec2(resolution.x / resolution.y, 1.);
      p += drift * (.0015 + star.w * .0045) * (1. - still);
      // Starlight passing the far black hole bends round it: each star is
      // seen where its brighter image falls, outside the ring, never across
      // the shadow, and brighter the nearer it passes.
      vec2 fromHole = p - hole.xy;
      float passing = length(fromHole);
      float einstein = hole.z * 1.7;
      p = hole.xy + fromHole / max(passing, 1e-5) * (passing + sqrt(passing * passing + 4. * einstein * einstein)) * .5;
      vec2 sun = center + vec2(cos(angle), sin(angle)) * (radius - .007);
      vec2 delta = p - sun;
      float attraction = exp(-dot(delta, delta) / .40);
      float c = max(0., charge - tail * .026) * (1. - still);
      p = sun + rotate(c * .46 * attraction) * delta * (1. - c * .20 * attraction);
      float e = max(pulse, 0.);
      vec2 eventDelta = p - (center + vec2(cos(pulseAngle), sin(pulseAngle)) * (radius - .007));
      float impulse = exp(-pow((length(eventDelta) - e * .32) / .07, 2.)) * (1. - smoothstep(2., 4.8, e)) * step(0., pulse) * (1. - still);
      p += (eventDelta / max(length(eventDelta), .0001)) * impulse * .004;
      location = p;
      gl_Position = vec4(p.x / (resolution.x / resolution.y) * 2. - 1., 1. - p.y * 2., 0., 1.);
      sharp = step(.988, star.w);
      gl_PointSize = mix(star.z, 20. + star.w * 8., sharp) * max(1., resolution.y / 900.);
      float twinkle = .82 + .18 * sin(clock * (.45 + star.w) + star.w * 123.);
      alpha = (.24 + star.w * .58 + sharp * .55) * twinkle;
      alpha *= tail < .5 ? 1. : charge * (1. - tail / 7.) * .19 * (1. - still);
      alpha *= 1. + impulse * .8;
      alpha *= 1. + .6 * exp(-passing * passing / (4. * einstein * einstein));
      alpha *= smoothstep(0., .03, s.x) * (1. - smoothstep(.97, 1., s.x)) * smoothstep(0., .03, s.y) * (1. - smoothstep(.97, 1., s.y));
      tint = mix(vec3(.49, .70, 1.), vec3(1., .69, .49), smoothstep(.32, .90, fract(star.w * 13.7)));
      tint = mix(tint, vec3(.93, .77, 1.), step(.87, fract(star.w * 7.)));
    }
  `;
const starFragment = `
    precision highp float;
    uniform vec2 center;
    uniform float radius;
    varying vec3 tint;
    varying float alpha;
    varying float sharp;
    varying vec2 location;
    void main() {
      float sky = smoothstep(.001, .004, length(location - center) - radius);
      vec2 p = gl_PointCoord - .5;
      float r = length(p);
      float ordinary = exp(-r * r * 23.);
      float core = exp(-r * r * 2100.);
      float rays = exp(-abs(p.x) * 260. - abs(p.y) * 13.) + exp(-abs(p.y) * 260. - abs(p.x) * 13.);
      float jewel = core * 2. + rays * .65 + exp(-r * r * 55.) * .035;
      gl_FragColor = vec4(tint * mix(ordinary, jewel, sharp), alpha * sky);
    }
  `;

/**
 * A point low on the right of the rim, as a fraction of the hero's height,
 * where the old horizon's rim burned brightest: beside the buttons rather
 * than behind the headline. The black hole and the distant sun are placed
 * from it. On a phone it is past the right edge, and the rim's end at the
 * edge stands in.
 */
const ANCHOR_HEIGHT = 0.72;

/**
 * How the light answers the pointer, gentler than the original's: it goes a
 * third of the way from where it rests toward the pointer, takes about a
 * second to get there rather than a quarter of one, and lights Europe a
 * little over half as much when the pointer comes near.
 */
const LIGHT_FOLLOW = 0.35;
const LIGHT_EASE = 1.1;
const LIGHT_REVEAL = 0.55;

/**
 * The circle the old orb horizon drew, in the renderer's units (the hero's
 * height is 1): its top 4.5rem down, under the header, its centre off the
 * left edge, and its size stepping with the screen's width and shape, as
 * `.marketing-horizon-planet` did. The steps are what keep the rim clear of
 * the tagline — on a wide screen against its height a circle has to be
 * flatter to pass the type column at the tagline's depth — and on a portrait
 * screen, where no circle clears it, the centre moves further off-screen so
 * the sweep still reaches down the right side.
 */
function rootRem() {
  return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
}

function horizonCircle(
  width: number,
  height: number,
): { center: [number, number]; radius: number } {
  const query = (media: string) => matchMedia(media).matches;
  let left = -0.5;
  let size = 3.2;
  if (query("(min-width: 40rem)")) {
    left = -0.25;
    size = 2.8;
  }
  if (query("(min-width: 64rem)")) {
    left = -0.04;
    size = query("(min-aspect-ratio: 2/1)")
      ? 3.4
      : query("(min-aspect-ratio: 8/5)")
        ? 2.9
        : 2.4;
  }
  const aspect = width / height;
  const radius = (size / 2) * aspect;
  return {
    center: [left * aspect, (4.5 * rootRem()) / height + radius],
    radius,
  };
}

/**
 * The part of the rim inside the hero, as the range of angles the light may
 * travel along — found by walking the circle rather than solving for each
 * edge, since which edges the rim crosses depends on the screen's shape.
 * Angles run as the pointer handler reads them, in (-2π, 0].
 */
function visibleArc(
  center: [number, number],
  radius: number,
  aspect: number,
): { low: number; high: number } {
  let low = Infinity;
  let high = -Infinity;
  for (let step = 0; step < 1440; step++) {
    const angle = -2 * Math.PI + (step / 1440) * 2 * Math.PI;
    const x = center[0] + Math.cos(angle) * radius;
    const y = center[1] + Math.sin(angle) * radius;
    if (x >= 0 && x <= aspect && y >= 0 && y <= 1) {
      low = Math.min(low, angle);
      high = Math.max(high, angle);
    }
  }
  if (!Number.isFinite(low)) {
    return { low: -Math.PI, high: 0 };
  }
  // Kept just inside the ends, so the light never sits on an edge.
  return { low: low + 0.035, high: high - 0.035 };
}

/**
 * Where the black hole sits: on the rim, a little over a third of the way
 * from its upper end toward the anchor (`ANCHOR_HEIGHT`), so above the
 * headline and below the nav on every screen, and far from the light. Its
 * centre is a little over half its shadow's radius above the rim,
 * so the planet cuts off the foot of the shadow; its disk is tilted a little
 * off the rim, so one end clears the horizon and the other goes behind it.
 * Smaller on a portrait screen, where the hero's height is a long way
 * across.
 */
function holePlace(
  center: [number, number],
  radius: number,
  low: number,
  anchor: number,
  aspect: number,
): [number, number, number, number] {
  const size = 0.036 * clamp(aspect, 0.75, 1);
  const angle = low + (anchor - low) * 0.36;
  const lift = radius + size * 0.6;
  return [
    center[0] + Math.cos(angle) * lift,
    center[1] + Math.sin(angle) * lift,
    size,
    // The rim's own slope there, less 0.3 radians.
    angle + Math.PI / 2 - 0.3,
  ];
}

/**
 * Where the distant sun sets, and the light rests in it: on the rim halfway
 * between the right edge of the hero's text column (`max-w-3xl` inside
 * `px-6`) and the anchor, so clear of the words; the sun's centre a third of
 * its radius below the rim, so a third of it shows above the horizon. On a
 * phone, where the column is the screen's width, that is the right edge.
 * Returns the angle on the rim, and the sun's centre and radius.
 */
function sunPlace(
  center: [number, number],
  radius: number,
  low: number,
  high: number,
  anchor: number,
  width: number,
  height: number,
): { angle: number; sun: [number, number, number] } {
  const rem = rootRem();
  const column = Math.min(48 * rem, width - 3 * rem);
  const columnEnd = (width + column) / 2 / height;
  const x = (columnEnd + center[0] + Math.cos(anchor) * radius) / 2;
  const angle = clamp(
    -Math.acos(clamp((x - center[0]) / radius, -1, 1)),
    low,
    high,
  );
  const size = 0.06 * clamp(width / height, 0.75, 1);
  const lift = radius - size / 3;
  return {
    angle,
    sun: [
      center[0] + Math.cos(angle) * lift,
      center[1] + Math.sin(angle) * lift,
      size,
    ],
  };
}

function createRenderer(
  canvas: HTMLCanvasElement,
  fallback: HTMLDivElement,
  initial: Options,
) {
  const context = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    depth: false,
    powerPreference: "low-power",
  });
  if (!context) {
    canvas.hidden = true;
    canvas.style.visibility = "hidden";
    canvas.dataset.status = "fallback";
    return { update: () => {}, dispose: () => {} };
  }
  const gl = context;
  let options = initial;
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  const still = () => options.reducedMotion ?? media.matches;
  const resources: Array<() => void> = [];
  const subscriptions: Array<() => void> = [];
  let disposed = false,
    visible = true,
    image: HTMLImageElement | null = null;
  let geometry: Geometry | undefined;
  let program: WebGLProgram, stars: WebGLProgram, buffer: WebGLBuffer;
  let starBuffer: WebGLBuffer;
  let texture: WebGLTexture,
    cosmos: WebGLTexture,
    uniforms: Uniforms,
    starUniforms: Uniforms;
  let position = 0,
    starPosition = 0,
    starTail = 0;
  const state = {
    angle: 0,
    target: 0,
    reveal: 0,
    targetReveal: 0,
    charge: 0,
    holding: false,
    pulse: -1,
    pulseAngle: 0,
    clock: 0,
    drift: [0, 0],
    targetDrift: [0, 0],
    ready: false,
    frame: 0,
    last: 0,
    lost: false,
  };

  function listen(
    target: EventTarget,
    type: string,
    callback: (event: Event) => void,
  ) {
    target.addEventListener(type, callback);
    subscriptions.push(() => target.removeEventListener(type, callback));
  }
  function required<T>(resource: T | null): T {
    if (!resource) throw new Error("WebGL allocation failed");
    return resource;
  }
  function compile(type: number, source: string) {
    const shader = required(gl.createShader(type));
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      throw new Error("Shader compilation failed");
    }
    return shader;
  }
  function link(v: string, f: string) {
    const shaders: WebGLShader[] = [];
    const result = required(gl.createProgram());
    resources.push(() => gl.deleteProgram(result));
    try {
      shaders.push(compile(gl.VERTEX_SHADER, v));
      shaders.push(compile(gl.FRAGMENT_SHADER, f));
      for (const shader of shaders) gl.attachShader(result, shader);
      gl.linkProgram(result);
      if (!gl.getProgramParameter(result, gl.LINK_STATUS))
        throw new Error("Shader linking failed");
      return result;
    } finally {
      shaders.forEach((shader) => gl.deleteShader(shader));
    }
  }
  function makeBuffer() {
    const b = required(gl.createBuffer());
    resources.push(() => gl.deleteBuffer(b));
    return b;
  }
  function makeTexture() {
    const t = required(gl.createTexture());
    resources.push(() => gl.deleteTexture(t));
    return t;
  }
  function locations(p: WebGLProgram, names: string[]): Uniforms {
    return Object.fromEntries(
      names.map((k) => [k, gl.getUniformLocation(p, k)]),
    );
  }
  function textureOptions() {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  function quad(p: WebGLProgram, at: number) {
    gl.useProgram(p);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(at);
    gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
  }
  function clearResources() {
    while (resources.length) resources.pop()!();
  }
  function resetTexture() {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGB,
      1,
      1,
      0,
      gl.RGB,
      gl.UNSIGNED_BYTE,
      new Uint8Array([5, 9, 16]),
    );
    textureOptions();
  }
  function setup() {
    clearResources();
    state.ready = false;
    program = link(vertex, fragment);
    position = gl.getAttribLocation(program, "position");
    uniforms = locations(program, [
      "resolution",
      "center",
      "radius",
      "angle",
      "reveal",
      "viewAngle",
      "earth",
      "cosmos",
      "clock",
      "charge",
      "pulse",
      "pulseAngle",
      "still",
      "drift",
      "hole",
      "galaxyBrightness",
      "surfaceBrightness",
      "auroraColor",
      "backgroundColor",
      "illumination",
      "farSun",
      "auroraPreview",
      "standingAurora",
    ]);
    buffer = makeBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const nebula = link(vertex, nebulaFragment);
    cosmos = makeTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, cosmos);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1536,
      1024,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
    textureOptions();
    const framebuffer = required(gl.createFramebuffer());
    try {
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        cosmos,
        0,
      );
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
        throw new Error("Incomplete framebuffer");
      quad(nebula, gl.getAttribLocation(nebula, "position"));
      gl.viewport(0, 0, 1536, 1024);
      gl.uniform2f(gl.getUniformLocation(nebula, "resolution"), 1536, 1024);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    } finally {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.deleteFramebuffer(framebuffer);
    }
    texture = makeTexture();
    resetTexture();
    stars = link(starVertex, starFragment);
    starPosition = gl.getAttribLocation(stars, "star");
    starTail = gl.getAttribLocation(stars, "tail");
    starUniforms = locations(stars, [
      "resolution",
      "center",
      "radius",
      "angle",
      "clock",
      "charge",
      "pulse",
      "pulseAngle",
      "still",
      "drift",
      "hole",
    ]);
    starBuffer = makeBuffer();
    updateStars();
    state.ready = true;
    canvas.hidden = false;
    canvas.style.visibility = "visible";
    if (image?.complete && image.naturalWidth) uploadTexture(image);
  }
  function updateStars() {
    let seed = 428731;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const data = new Float32Array(options.starCount * 35);
    let at = 0;
    for (let i = 0; i < options.starCount; i++) {
      const x = random(),
        y = random(),
        size = 1 + Math.pow(random(), 2.4) * 2.6,
        identity = random();
      for (let tail = 0; tail < 7; tail++) {
        data.set([x, y, size, identity, tail], at);
        at += 5;
      }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, starBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  }
  function uploadTexture(earthImage: HTMLImageElement) {
    try {
      let source: TexImageSource = earthImage;
      const limit = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), 4096);
      if (Math.max(earthImage.width, earthImage.height) > limit) {
        const small = document.createElement("canvas");
        const ratio = limit / Math.max(earthImage.width, earthImage.height);
        small.width = Math.max(1, Math.round(earthImage.width * ratio));
        small.height = Math.max(1, Math.round(earthImage.height * ratio));
        required(small.getContext("2d")).drawImage(
          earthImage,
          0,
          0,
          small.width,
          small.height,
        );
        source = small;
      }
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, source);
      canvas.dataset.texture = "ready";
    } catch {
      resetTexture();
      canvas.dataset.texture = "unavailable";
    }
    requestFrame();
  }
  function loadTexture() {
    if (image) {
      image.onload = null;
      image.onerror = null;
    }
    image = null;
    if (state.ready && !state.lost) resetTexture();
    canvas.dataset.texture = "loading";
    if (!options.textureUrl) {
      canvas.dataset.texture = "unavailable";
      return;
    }
    const pending = new Image();
    image = pending;
    pending.crossOrigin = "anonymous";
    pending.onload = () => {
      if (!disposed && image === pending && state.ready && !state.lost)
        uploadTexture(pending);
    };
    pending.onerror = () => {
      if (!disposed && image === pending)
        canvas.dataset.texture = "unavailable";
    };
    pending.src = options.textureUrl;
  }
  function resize() {
    if (state.lost || disposed) return;
    const box = canvas.getBoundingClientRect();
    if (!box.width || !box.height) {
      stop();
      return;
    }
    const aspect = box.width / box.height;
    const maxSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
    const dpr = Math.min(
      devicePixelRatio || 1,
      2,
      Math.sqrt(3000000 / (box.width * box.height)),
      maxSize / box.width,
      maxSize / box.height,
    );
    canvas.width = Math.max(1, Math.round(box.width * dpr));
    canvas.height = Math.max(1, Math.round(box.height * dpr));
    const { center, radius } = horizonCircle(box.width, box.height);
    const { low, high } = visibleArc(center, radius, aspect);
    const anchorY = ANCHOR_HEIGHT - center[1];
    const anchor = clamp(
      Math.atan2(
        anchorY,
        Math.sqrt(Math.max(0, radius * radius - anchorY * anchorY)),
      ),
      low,
      high,
    );
    const hole = holePlace(center, radius, low, anchor, aspect);
    // The light rests in the distant sun.
    const { angle: rest, sun } = sunPlace(
      center,
      radius,
      low,
      high,
      anchor,
      box.width,
      box.height,
    );
    if (geometry) {
      state.angle += rest - geometry.rest;
      state.target += rest - geometry.rest;
    } else state.angle = state.target = rest;
    geometry = { center, radius, low, high, rest, hole, sun };
    state.angle = clamp(state.angle, low, high);
    state.target = clamp(state.target, low, high);
    requestFrame();
  }
  function stop() {
    cancelAnimationFrame(state.frame);
    state.frame = 0;
    state.last = 0;
  }
  function requestFrame() {
    if (
      !state.frame &&
      !disposed &&
      visible &&
      !document.hidden &&
      !state.lost &&
      state.ready &&
      geometry
    )
      state.frame = requestAnimationFrame(draw);
  }
  function common(u: Uniforms) {
    const g = geometry!;
    gl.uniform2f(u.resolution!, canvas.width, canvas.height);
    gl.uniform2f(u.center!, ...g.center);
    gl.uniform1f(u.radius!, g.radius);
    gl.uniform1f(u.angle!, state.angle);
    gl.uniform1f(u.clock!, still() ? 0 : state.clock);
    gl.uniform1f(u.charge!, state.charge);
    gl.uniform1f(u.pulse!, still() ? -1 : state.pulse);
    gl.uniform1f(u.still!, still() ? 1 : 0);
    gl.uniform1f(u.pulseAngle!, state.pulseAngle);
    gl.uniform4f(u.hole!, ...g.hole);
    gl.uniform2f(
      u.drift!,
      still() ? 0 : state.drift[0]!,
      still() ? 0 : state.drift[1]!,
    );
  }
  function draw(now: number) {
    state.frame = 0;
    if (disposed || state.lost || !visible || document.hidden || !geometry)
      return;
    const moving =
      Math.abs(state.target - state.angle) > 0.0001 ||
      Math.abs(state.targetReveal - state.reveal) > 0.001;
    if (
      !moving &&
      !state.holding &&
      state.charge < 0.001 &&
      state.pulse < 0 &&
      state.last &&
      now - state.last < 32 &&
      !still()
    ) {
      requestFrame();
      return;
    }
    const dt = Math.min((now - (state.last || now - 16)) / 1000, 0.05);
    state.last = now;
    state.clock += dt;
    const movement = still() ? 1 : 1 - Math.exp(-dt / LIGHT_EASE);
    const exposure = still()
      ? 1
      : 1 - Math.exp(-dt / (state.targetReveal > state.reveal ? 1.6 : 1.1));
    state.angle += (state.target - state.angle) * movement;
    state.reveal += (state.targetReveal - state.reveal) * exposure;
    state.charge +=
      ((state.holding ? 1 : 0) - state.charge) *
      (still() ? 1 : 1 - Math.exp(-dt / (state.holding ? 0.68 : 0.5)));
    state.drift = state.drift.map(
      (v, i) => v + (state.targetDrift[i]! - v) * movement * 0.5,
    );
    if (state.pulse >= 0) {
      state.pulse += dt;
      if (state.pulse > 5) state.pulse = -1;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.disable(gl.BLEND);
    gl.disableVertexAttribArray(starTail);
    quad(program, position);
    common(uniforms);
    gl.uniform1f(uniforms.reveal!, state.reveal);
    gl.uniform1f(uniforms.viewAngle!, geometry.rest);
    gl.uniform1f(uniforms.galaxyBrightness!, options.galaxyBrightness);
    gl.uniform1f(uniforms.surfaceBrightness!, options.surfaceBrightness);
    gl.uniform4f(uniforms.auroraColor!, ...options.auroraColor);
    gl.uniform4f(uniforms.backgroundColor!, ...options.backgroundColor);
    gl.uniform1f(uniforms.illumination!, options.illumination);
    gl.uniform3f(uniforms.farSun!, ...geometry.sun);
    gl.uniform1f(
      uniforms.auroraPreview!,
      options.auroraPreview && options.auroraEnabled ? 1 : 0,
    );
    gl.uniform1f(
      uniforms.standingAurora!,
      options.auroraEnabled ? options.aurora : 0,
    );
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(uniforms.earth!, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, cosmos);
    gl.uniform1i(uniforms.cosmos!, 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.useProgram(stars);
    common(starUniforms);
    gl.bindBuffer(gl.ARRAY_BUFFER, starBuffer);
    gl.enableVertexAttribArray(starPosition);
    gl.enableVertexAttribArray(starTail);
    gl.vertexAttribPointer(starPosition, 4, gl.FLOAT, false, 20, 0);
    gl.vertexAttribPointer(starTail, 1, gl.FLOAT, false, 20, 16);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.drawArrays(gl.POINTS, 0, options.starCount * 7);
    gl.disable(gl.BLEND);
    canvas.dataset.status = "ready";
    fallback.hidden = true;
    if (!still()) requestFrame();
  }
  function point(event: PointerEvent) {
    if (!geometry) return;
    const box = canvas.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.height - geometry.center[0];
    const y = (event.clientY - box.top) / box.height - geometry.center[1];
    let angle = Math.atan2(y, x);
    if (angle > 0) angle -= Math.PI * 2;
    state.target = clamp(
      geometry.rest + (angle - geometry.rest) * LIGHT_FOLLOW,
      geometry.low,
      geometry.high,
    );
    const distance = Math.hypot(x, y) - geometry.radius;
    state.targetReveal =
      LIGHT_REVEAL *
      Math.exp(-Math.pow((angle - geometry.rest) / 0.15, 2)) *
      Math.exp(-Math.pow((distance + 0.015) / 0.12, 2));
    state.targetDrift = [
      (event.clientX - box.left) / box.width - 0.5,
      (event.clientY - box.top) / box.height - 0.5,
    ];
    requestFrame();
  }
  function release(celebrate = true) {
    if (
      state.holding &&
      state.charge > 0.42 &&
      celebrate &&
      !still() &&
      options.auroraEnabled
    ) {
      state.pulse = 0;
      state.pulseAngle = state.angle;
    }
    state.holding = false;
    requestFrame();
  }
  function rest() {
    release(false);
    state.target = geometry?.rest ?? 0;
    state.targetReveal = 0;
    state.targetDrift = [0, 0];
    requestFrame();
  }
  function pointer(type: string, fn: (event: PointerEvent) => void) {
    listen(canvas, type, (event) => {
      if (options.interactive && geometry) fn(event as PointerEvent);
    });
  }
  pointer("pointermove", (e) => {
    if (e.isPrimary) point(e);
  });
  pointer("pointerdown", (e) => {
    if (!e.isPrimary || e.button !== 0) return;
    canvas.setPointerCapture(e.pointerId);
    state.holding = options.auroraEnabled;
    point(e);
    state.pulseAngle = state.target;
  });
  pointer("pointerup", (e) => {
    if (!e.isPrimary) return;
    release();
    if (canvas.hasPointerCapture(e.pointerId))
      canvas.releasePointerCapture(e.pointerId);
    if (e.pointerType !== "mouse") state.targetReveal = 0;
  });
  pointer("pointercancel", rest);
  pointer("lostpointercapture", () => release(false));
  pointer("pointerleave", (e) => {
    if (e.pointerType !== "touch" && !canvas.hasPointerCapture(e.pointerId))
      rest();
  });
  listen(window, "blur", rest);
  listen(media, "change", () => {
    state.pulse = -1;
    state.last = 0;
    requestFrame();
  });
  listen(document, "visibilitychange", () => {
    if (document.hidden) {
      state.holding = false;
      stop();
    } else requestFrame();
  });
  function fail() {
    state.ready = false;
    stop();
    canvas.hidden = true;
    canvas.style.visibility = "hidden";
    fallback.hidden = false;
    canvas.dataset.status = "fallback";
    clearResources();
  }
  listen(canvas, "webglcontextlost", (event) => {
    event.preventDefault();
    state.lost = true;
    state.ready = false;
    state.holding = false;
    state.charge = 0;
    state.pulse = -1;
    stop();
    // Context loss has already released these GPU handles.
    resources.length = 0;
    canvas.hidden = true;
    canvas.style.visibility = "hidden";
    fallback.hidden = false;
    canvas.dataset.status = "fallback";
  });
  listen(canvas, "webglcontextrestored", () => {
    state.lost = false;
    try {
      setup();
      resize();
    } catch {
      fail();
    }
  });
  const resizeObserver = new ResizeObserver(resize);
  const intersection = new IntersectionObserver((entries) => {
    visible = entries[0]?.isIntersecting ?? false;
    if (visible) {
      state.last = 0;
      requestFrame();
    } else {
      state.holding = false;
      stop();
    }
  });
  resizeObserver.observe(canvas);
  intersection.observe(canvas);
  listen(window, "resize", resize);
  try {
    setup();
    resize();
    loadTexture();
  } catch {
    fail();
  }
  return {
    update(next: Options) {
      const previous = options;
      options = next;
      if (!options.interactive || !options.auroraEnabled) {
        state.holding = false;
        state.charge = 0;
        state.pulse = -1;
      }
      if (!options.interactive) rest();
      if (previous.reducedMotion !== options.reducedMotion) state.pulse = -1;
      if (
        previous.starCount !== options.starCount &&
        state.ready &&
        !state.lost
      )
        updateStars();
      if (previous.textureUrl !== options.textureUrl) loadTexture();
      state.last = 0;
      requestFrame();
    },
    dispose() {
      disposed = true;
      stop();
      resizeObserver.disconnect();
      intersection.disconnect();
      subscriptions.forEach((unsubscribe) => unsubscribe());
      if (image) {
        image.onload = null;
        image.onerror = null;
        image = null;
      }
      clearResources();
      canvas.dataset.status = "disposed";
    },
  };
}
