"use client";

import { useEffect, useRef } from "react";
import { Program, Mesh, Renderer, Triangle, Vec2 } from "ogl";
import type { MotionValue } from "motion/react";
import { Orb } from "@/components/brand/Orb";
import { cn } from "@/lib/utils";

const vertex = /* glsl */ `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0., 1.); }
`;

/**
 * The orb, lit: a sphere drawn analytically per pixel. Inside, warm clouds
 * turning slowly (3D value noise on the sphere's surface, so they wrap round
 * it rather than slide across); a gold rim where the glass is seen edge on;
 * a highlight where the light — the pointer — catches it; a halo breathing
 * round it. Below, the dark curve of a horizon with a lit rim, the orb
 * rising out of it as `uRise` goes from 0 to 1: the hero's sunrise, at the
 * end of the page.
 */
const fragment = /* glsl */ `
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
uniform float uRise;
uniform vec2 uPointer;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i + vec3(0, 0, 0)), hash(i + vec3(1, 0, 0)), f.x),
        mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
        mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}
float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return v;
}
mat3 turn(float a) {
  float c = cos(a), s = sin(a);
  return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  float side = min(uResolution.x, uResolution.y);
  vec2 p = (frag - 0.5 * uResolution) / side;

  // The orb climbs from behind the horizon to sit above it.
  float radius = 0.2;
  vec2 centre = vec2(0.0, mix(-0.58, 0.13, uRise));
  vec2 q = (p - centre) / radius;
  float r = length(q);

  vec3 gold = vec3(0.925, 0.698, 0.369);
  vec3 ember = vec3(0.62, 0.24, 0.07);
  vec3 colour = vec3(0.0);
  float alpha = 0.0;

  // Halo: soft gold light round the orb, stronger as it clears the horizon.
  float halo = exp(-max(r - 1.0, 0.0) * 2.6) * (0.25 + 0.55 * uRise);
  colour += gold * halo * 0.55;
  alpha += halo * 0.55;

  if (r < 1.0) {
    vec3 n = vec3(q, sqrt(1.0 - r * r));
    vec3 light = normalize(vec3(uPointer * 0.9, 0.85));
    vec3 view = vec3(0.0, 0.0, 1.0);

    // The clouds inside, turning on the sphere.
    vec3 s = turn(uTime * 0.12) * n;
    float clouds = fbm(s * 2.4 + vec3(0.0, uTime * 0.05, 0.0));
    float swirl = fbm(s * 4.0 - vec3(uTime * 0.07, 0.0, uTime * 0.03));
    float inside = smoothstep(0.25, 0.85, clouds * 0.75 + swirl * 0.45);

    float diffuse = max(dot(n, light), 0.0);
    float fresnel = pow(1.0 - n.z, 2.6);
    float spec = pow(max(dot(reflect(-light, n), view), 0.0), 42.0);

    vec3 body = mix(ember * 0.55, gold, inside);
    body *= 0.35 + 0.85 * diffuse;
    body += gold * fresnel * 1.25;
    body += vec3(1.0, 0.95, 0.85) * spec * 0.9;
    // Glass: the middle a touch clearer than the edge.
    float glass = mix(0.78, 1.0, fresnel);

    float edge = smoothstep(1.0, 0.985, r);
    colour = mix(colour, body, edge);
    alpha = mix(alpha, glass, edge);
  }

  // The horizon: a wide dark curve with a lit rim, hiding the orb's lower
  // half until it rises.
  float horizon = -0.38;
  float curve = horizon - 0.55 * pow(p.x / 1.6, 2.0);
  float below = smoothstep(curve + 0.002, curve - 0.002, p.y);
  float rim = exp(-abs(p.y - curve) * 90.0) * (0.35 + 0.65 * uRise);
  float lit = exp(-abs(p.x - centre.x) * 1.6);
  colour = mix(colour, vec3(0.012, 0.012, 0.02), below);
  alpha = mix(alpha, 1.0, below);
  colour += gold * rim * lit * 0.9;
  alpha = max(alpha, rim * lit * 0.9);

  gl_FragColor = vec4(colour * alpha, alpha);
}
`;

/**
 * The closing section's orb, in WebGL (`ogl`, the library the app's veil
 * already uses). Its rise is handed in as a motion value, read every frame;
 * the pointer moves its light, eased. It draws only while on screen, holds
 * still under reduced motion, and falls back to the CSS orb where WebGL is
 * not there.
 */
export function GoldOrb({
  rise,
  className,
}: {
  rise: MotionValue<number>;
  className?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const fallback = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = host.current;
    if (!element) {
      return;
    }
    const media = matchMedia("(prefers-reduced-motion: reduce)");

    let renderer: Renderer;
    try {
      renderer = new Renderer({
        dpr: Math.min(window.devicePixelRatio, 1.5),
        alpha: true,
        premultipliedAlpha: true,
        antialias: false,
      });
    } catch {
      fallback.current?.removeAttribute("hidden");
      return;
    }
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    const canvas = gl.canvas as HTMLCanvasElement;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.setAttribute("aria-hidden", "true");
    element.appendChild(canvas);

    let program: Program;
    try {
      program = new Program(gl, {
        vertex,
        fragment,
        transparent: true,
        uniforms: {
          uResolution: { value: new Vec2() },
          uTime: { value: 0 },
          uRise: { value: 0 },
          uPointer: { value: new Vec2(0.35, 0.45) },
        },
      });
    } catch {
      canvas.remove();
      fallback.current?.removeAttribute("hidden");
      return;
    }
    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

    const target = new Vec2(0.35, 0.45);
    function onPointer(event: PointerEvent) {
      const box = element!.getBoundingClientRect();
      target.set(
        ((event.clientX - box.left) / box.width) * 2 - 1,
        -(((event.clientY - box.top) / box.height) * 2 - 1),
      );
    }
    window.addEventListener("pointermove", onPointer, { passive: true });

    function resize() {
      const { width, height } = element!.getBoundingClientRect();
      renderer.setSize(width, height);
      program.uniforms.uResolution.value.set(
        gl.drawingBufferWidth,
        gl.drawingBufferHeight,
      );
    }
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();

    let visible = false;
    let frame = 0;
    const seen = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      if (visible && !frame) {
        frame = requestAnimationFrame(draw);
      }
    });
    seen.observe(element);

    const start = performance.now();
    function draw(now: number) {
      frame = 0;
      const still = media.matches;
      const pointer = program.uniforms.uPointer.value as Vec2;
      if (!still) {
        pointer.x += (target.x - pointer.x) * 0.06;
        pointer.y += (target.y - pointer.y) * 0.06;
      }
      program.uniforms.uTime.value = still ? 4 : (now - start) / 1000;
      program.uniforms.uRise.value = still ? 1 : rise.get();
      renderer.render({ scene: mesh });
      if (visible && !still) {
        frame = requestAnimationFrame(draw);
      }
    }
    // Under reduced motion, one frame now and one per change of rise.
    const unsubscribe = rise.on("change", () => {
      if (media.matches && visible && !frame) {
        frame = requestAnimationFrame(draw);
      }
    });
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      unsubscribe();
      seen.disconnect();
      observer.disconnect();
      window.removeEventListener("pointermove", onPointer);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
    };
  }, [rise]);

  return (
    <div ref={host} className={cn("absolute inset-0", className)} aria-hidden>
      {/* Shown only where WebGL is not there. */}
      <div
        ref={fallback}
        hidden
        className="absolute inset-0 flex items-center justify-center"
      >
        <Orb size="min(22rem, 60vw)" />
      </div>
    </div>
  );
}
