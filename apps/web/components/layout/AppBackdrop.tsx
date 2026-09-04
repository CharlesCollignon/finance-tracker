"use client";

import { useCallback, useState } from "react";
import DarkVeil from "@/components/DarkVeil";
import { cn } from "@/lib/utils";

/**
 * The ground the whole app sits on.
 *
 * Two layers, and the order matters. The bloom is CSS, and it is the floor:
 * it defines the look, it costs nothing, and it is what everybody sees. The
 * shader goes on top of it and adds the one thing CSS cannot — a drift slow
 * enough that you never catch it moving, which is most of why the reference
 * looks expensive rather than printed.
 *
 * Built that way round on purpose. The obvious arrangement is a shader with a
 * gradient behind it in case the shader fails, but then the fallback is a
 * second design nobody looks at and it rots. Here there is one design, and
 * the shader is a refinement of it: when WebGL is missing, blocklisted, or on
 * a software renderer that will not link a program this large — a VM, a
 * remote desktop, an old driver — the page is very slightly flatter and
 * nothing else changes.
 *
 * Mounted once, in the shell. A WebGL context is expensive to create and
 * browsers cap how many can be live at once, so one that survives navigation
 * beats one per page; the drift should not restart when someone changes
 * surface; and the cards above are translucent, so a backdrop that unmounted
 * mid-navigation would flash through them.
 */

/**
 * The bloom, as three offset lights.
 *
 * One centred glow reads as a spotlight. Three of different hue, size and
 * position read as depth: the violet high and wide, a magenta out to one side
 * as if from a second source off-frame, and the brand gold low and faint so
 * the palette still belongs to Pluclair rather than to the reference it was
 * drawn from.
 *
 * Written as a style object rather than an arbitrary Tailwind class: three
 * stacked gradients in a `bg-[...]` literal is a single unreadable token that
 * cannot be commented, and this is the one thing on the screen most likely to
 * be tuned by hand.
 */
const BLOOM = [
  // The main light, centred on the content rather than on the window — see
  // `--bloom-x` below.
  "radial-gradient(95% 60% at var(--bloom-x) -10%, rgba(139,74,255,0.55) 0%, rgba(124,58,237,0.24) 44%, transparent 72%)",
  // A second source off to the right, as if out of frame.
  "radial-gradient(55% 45% at 92% 8%, rgba(232,74,178,0.26) 0%, transparent 66%)",
  // Indigo down the left, which keeps the side rail from reading as a
  // separate black panel bolted onto a coloured page.
  "radial-gradient(45% 55% at 0% 30%, rgba(88,52,196,0.26) 0%, transparent 70%)",
  // The lower half was dead black, which made the page look like a bloom
  // pasted onto a void rather than a lit room. This is the bounce.
  "radial-gradient(95% 60% at var(--bloom-x) 82%, rgba(84,48,160,0.30) 0%, transparent 74%)",
  // The brand gold, low and faint, so the palette still belongs to Pluclair
  // rather than to the reference it was drawn from.
  "radial-gradient(60% 40% at 12% 100%, rgba(224,190,122,0.10) 0%, transparent 70%)",
].join(", ");

/** Rotates the shader's own palette toward the reference's violet. */
const HUE_SHIFT = 258;

/**
 * Rendered at a third of resolution, and blurred hard on top of that.
 *
 * The shader is a CPPN, and left alone it draws structure: hard-edged
 * diagonal streaks that read as a smear across the page rather than as light.
 * What is wanted from it is only the one thing CSS cannot do — colour that
 * drifts — so it is thrown far out of focus until nothing but the colour
 * survives. Cheap, too: a third of the pixels, and the blur hides every
 * artefact that comes of rendering it small.
 */
const RESOLUTION_SCALE = 0.34;
const SHADER_BLUR = "blur(64px)";

export function AppBackdrop() {
  const [shaderFailed, setShaderFailed] = useState(false);

  // Stable, so a failure does not retrigger the shader's setup effect and
  // loop on a machine that cannot run it.
  const onUnavailable = useCallback(() => setShaderFailed(true), []);

  return (
    <div
      aria-hidden
      /*
       * `--bloom-x` is where the light is centred, and it is not the middle
       * of the window. On a desktop the side rail takes the first 224–256px,
       * so the content column's optical centre sits about 58% across — and a
       * bloom centred at 50% reads as sitting off to the left of everything
       * it is meant to be lighting. On a phone there is no rail and 50% is
       * the middle of the content, which is the same rule with a different
       * answer.
       */
      className={cn(
        "pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background",
        "[--bloom-x:50%] md:[--bloom-x:58%]",
      )}
    >
      {/* The bloom. Two offset radials rather than one: a single centred glow
          reads as a spotlight, while two of different hue and size read as
          depth — the violet high and wide, a warmer gold low and tight, the
          way the reference has a second light source out of frame. */}
      <div className="absolute inset-0" style={{ background: BLOOM }} />

      {/* Rendered straight away rather than waiting for mount. An unpainted
          canvas is transparent, and the bloom is underneath it — so on the
          server, and for the moment before the shader's first frame, what
          shows through is the finished design rather than a hole.

          `scale-110` because a blur of this radius samples nothing outside
          the element and fades the edges towards transparent; oversizing puts
          those soft edges off-screen. */}
      {!shaderFailed ? (
        <div
          className="absolute inset-0 scale-110 opacity-45 mix-blend-screen"
          style={{ filter: SHADER_BLUR }}
        >
          <DarkVeil
            onUnavailable={onUnavailable}
            hueShift={HUE_SHIFT}
            speed={0.28}
            warpAmount={0.06}
            noiseIntensity={0.02}
            scanlineIntensity={0}
            resolutionScale={RESOLUTION_SCALE}
          />
        </div>
      ) : null}

      {/* One wash, at the bottom only, and shallower than it was. An
          all-over vignette was the obvious thing and it flattened the bloom
          back to nothing — the corners were already dark, so darkening them
          again only cost the violet. The band stays because the phone's
          floating nav bar sits there and needs a dark ground under it. */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background/90 to-transparent" />
    </div>
  );
}
