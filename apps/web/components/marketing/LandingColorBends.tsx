"use client";

import dynamic from "next/dynamic";
import {
  useHasMounted,
  usePrefersReducedMotion,
} from "@/components/marketing/use-prefers-reduced-motion";

const ColorBends = dynamic(
  () => import("@/components/react-bits/ColorBends"),
  { ssr: false },
);

export function LandingColorBends() {
  const mounted = useHasMounted();
  const reduced = usePrefersReducedMotion();

  if (!mounted || reduced) {
    return null;
  }

  return (
    <ColorBends
      colors={["#d4af37", "#71717a", "#3f3f46"]}
      rotation={90}
      speed={0.12}
      scale={1}
      frequency={1}
      warpStrength={1}
      mouseInfluence={0.25}
      noise={0.08}
      parallax={0.5}
      iterations={1}
      intensity={0.45}
      bandWidth={8}
      transparent
      autoRotate={0}
    />
  );
}
