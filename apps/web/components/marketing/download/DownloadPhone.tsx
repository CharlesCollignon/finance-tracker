"use client";

import { useEffect } from "react";
import {
  animate,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";
import { FeatureMock } from "@/components/marketing/LandingMocks";
import { Phone3D } from "@/components/marketing/landing/Phone3D";

/** Where the phone rests, a little turned towards the text. */
const REST_X = 4;
const REST_Y = -14;

/**
 * The download page's phone: Le point on it, as the app opens.
 *
 * It arrives — rising and turning in from further round, once — and then
 * rests, as DESIGN.md asks of anything that moves on its own. Past that it
 * only answers the pointer, leaning a few degrees towards it and settling
 * back when it leaves. With reduced motion it is simply there, at rest.
 */
export function DownloadPhone() {
  const reduced = useReducedMotion();
  const turnX = useMotionValue(reduced ? REST_X : 12);
  const turnY = useMotionValue(reduced ? REST_Y : -38);
  const lift = useMotionValue(reduced ? 0 : 36);
  const rotateX = useSpring(turnX, { stiffness: 120, damping: 18 });
  const rotateY = useSpring(turnY, { stiffness: 120, damping: 18 });
  const y = useSpring(lift, { stiffness: 90, damping: 16 });

  useEffect(() => {
    if (reduced) {
      // Known only once on the client: wherever the first render put it,
      // the phone is at rest at once, with no spring to it.
      [turnX, rotateX].forEach((value) => value.jump(REST_X));
      [turnY, rotateY].forEach((value) => value.jump(REST_Y));
      [lift, y].forEach((value) => value.jump(0));
      return;
    }
    const arrival = [
      animate(turnX, REST_X, { duration: 1.1, delay: 0.3 }),
      animate(turnY, REST_Y, { duration: 1.1, delay: 0.3 }),
      animate(lift, 0, { duration: 1.1, delay: 0.3 }),
    ];
    // A fine pointer only: on a touch screen there is nothing to follow.
    const fine = window.matchMedia("(pointer: fine)").matches;
    function lean(event: PointerEvent) {
      const across = event.clientX / window.innerWidth - 0.5;
      const down = event.clientY / window.innerHeight - 0.5;
      turnY.set(REST_Y + across * 18);
      turnX.set(REST_X - down * 10);
    }
    function settle() {
      turnY.set(REST_Y);
      turnX.set(REST_X);
    }
    if (fine) {
      window.addEventListener("pointermove", lean);
      document.documentElement.addEventListener("pointerleave", settle);
    }
    return () => {
      arrival.forEach((controls) => controls.stop());
      window.removeEventListener("pointermove", lean);
      document.documentElement.removeEventListener("pointerleave", settle);
    };
  }, [reduced, turnX, turnY, lift, rotateX, rotateY, y]);

  return (
    <div className="relative flex items-center justify-center">
      {/* The phone's own light, behind it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 size-[min(34rem,90vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(250_152_66/0.18),transparent)] blur-2xl"
      />
      <Phone3D
        rotateX={rotateX}
        rotateY={rotateY}
        y={y}
        className="h-[min(70vh,40rem)] w-auto [aspect-ratio:9/19.5]"
      >
        <FeatureMock pageId="bearing" variant="mobile" />
      </Phone3D>
    </div>
  );
}
