import { View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

/**
 * The ground the app sits on, as the phone can draw it.
 *
 * The web app renders this as a WebGL shader over a CSS bloom, and the bloom
 * is the half that carries the look — so this is that half, drawn with SVG
 * gradients. Deliberately not a port of the shader: there is no WebGL here,
 * and a JS-driven animation of a full-screen gradient would cost battery all
 * day to produce a drift nobody is looking at.
 *
 * Three offset lights rather than one. A single centred glow reads as a
 * spotlight; three of different hue, size and position read as depth — the
 * violet high and wide, a magenta from a source off to one side, and the
 * brand gold low and faint so the palette still belongs to Pluclair rather
 * than to the reference it was drawn from. The same four stops as the web
 * `BLOOM`, so the two apps are recognisably the same product.
 *
 * `pointerEvents="none"` and absolutely filled: nothing above it needs to
 * know it is there.
 */

/** Matching `apps/web/components/layout/AppBackdrop.tsx`. */
const LIGHTS = [
  {
    id: "violet",
    cx: "50%",
    cy: "-8%",
    r: "85%",
    color: "#8b4aff",
    opacity: 0.55,
  },
  {
    id: "magenta",
    cx: "88%",
    cy: "12%",
    r: "50%",
    color: "#e84ab2",
    opacity: 0.3,
  },
  {
    id: "indigo",
    cx: "6%",
    cy: "42%",
    r: "55%",
    color: "#5834c4",
    opacity: 0.28,
  },
  {
    id: "gold",
    cx: "18%",
    cy: "96%",
    r: "70%",
    color: "#e0be7a",
    opacity: 0.1,
  },
] as const;

export function AppBackdrop() {
  return (
    <View
      pointerEvents="none"
      className="absolute inset-0 bg-background"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width="100%" height="100%">
        <Defs>
          {LIGHTS.map((light) => (
            <RadialGradient
              key={light.id}
              id={light.id}
              cx={light.cx}
              cy={light.cy}
              r={light.r}
            >
              <Stop
                offset="0"
                stopColor={light.color}
                stopOpacity={light.opacity}
              />
              <Stop offset="1" stopColor={light.color} stopOpacity={0} />
            </RadialGradient>
          ))}
          {/* The bottom band. The floating tab bar sits there and needs a dark
              ground under it, the same reason the web backdrop keeps one. */}
          <RadialGradient id="floor" cx="50%" cy="112%" r="70%">
            <Stop offset="0" stopColor="#0a0a10" stopOpacity={0.95} />
            <Stop offset="1" stopColor="#0a0a10" stopOpacity={0} />
          </RadialGradient>
        </Defs>

        {/* One rect per light, stacked. SVG has no multi-fill, and stacking
            is what `background: a, b, c` does in CSS anyway. */}
        {LIGHTS.map((light) => (
          <Rect
            key={light.id}
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill={`url(#${light.id})`}
          />
        ))}
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#floor)" />
      </Svg>
    </View>
  );
}
