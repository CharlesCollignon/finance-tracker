import { useEffect, useId } from "react";
import { View, type ViewProps } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, {
  ClipPath,
  Defs,
  Ellipse,
  FeGaussianBlur,
  Filter,
  G,
  RadialGradient,
  Stop,
} from "react-native-svg";

import { Blur } from "@/components/ui/Blur";
import { cn } from "@/lib/cn";

type OrbSize = "sm" | "nav" | "hero" | "login" | "watermark";

export interface OrbProps extends ViewProps {
  size?: OrbSize;
  /** "loading" rolls the whole ball; see the note on the component. */
  spin?: "none" | "loading";
  className?: string;
}

const BOX: Record<OrbSize, number> = {
  sm: 26,
  nav: 40,
  hero: 88,
  login: 160,
  watermark: 320,
};

/**
 * How much glass, per size — a ramp, not two settings.
 *
 * The watermark is a near-clear shell, which works because it has a whole
 * screen of room around it and the veil behind to light it. Nothing smaller
 * does: as the ball shrinks it has fewer pixels to say "sphere" with, and a
 * clear one stops reading as an object and starts reading as a smudge on
 * whatever is behind it. So the tint thickens as the box shrinks. Same
 * shape, same clouds, more glass.
 *
 * `hero` is the loading indicator as well as the onboarding mark, which is
 * why it sits well up the ramp despite the name: an indicator that takes its
 * colour from the content behind it is not indicating much.
 *
 * The web orb calls this `--orb-glass`, and its `.pc-orb-mark` is this
 * ramp's top end.
 */
const GLASS: Record<OrbSize, number> = {
  sm: 2.6,
  nav: 2.3,
  hero: 1.7,
  login: 1.2,
  watermark: 1,
};

/** A full roll of the loading indicator, in ms. */
const LOADING_PERIOD = 1600;

/**
 * The two cloud layers' periods, in ms — one clockwise, one back. Not
 * multiples of each other, so the masses drift past each other instead of
 * turning together in a pattern the eye can lock onto.
 */
const DRIFT_PERIOD = 45_000;
const COUNTER_DRIFT_PERIOD = 62_000;

/**
 * The mark's own family: light caught in the glass, body gold, shadow gold.
 * Kept in step with `--orb-c1/2/3` in the web stylesheet — the two orbs are
 * the same object and a drift between them shows immediately on a landing
 * page that puts screenshots of the app beside the hero.
 *
 * More chroma than the flat mark these replaced. Those values were picked to
 * sit on an opaque gold ball; painted at low alpha over a near-black screen
 * the same gold comes out khaki.
 */
const C1 = "#fff0bd";
const C2 = "#f2c96a";
const C3 = "#5c3e10";

/** Alpha times glass, clamped — 2.6 × 0.72 would otherwise ask for 187%. */
const a = (alpha: number, glass: number) => Math.min(1, alpha * glass);

/**
 * One drifting cloud layer.
 *
 * Two soft masses per layer, drawn as ellipses whose radial gradients fade
 * to nothing well inside the shell, then run through a gaussian blur so the
 * two read as one body of colour rather than as two blobs. The blur is the
 * finish, not the shape: if `FeGaussianBlur` no-ops — it is the one thing
 * here that leans on a recent react-native-svg, and Android composites SVG
 * filters differently from iOS — the gradients are soft enough on their own
 * that the orb degrades to slightly crisper clouds rather than to blobs.
 *
 * Clipped to the circle, because a mass whose gradient has not finished
 * falling off by the rim would otherwise show as a bite out of the sphere's
 * edge.
 */
function CloudLayer({
  box,
  glass,
  id,
  masses,
}: {
  box: number;
  glass: number;
  id: string;
  masses: {
    cx: number;
    cy: number;
    rx: number;
    ry: number;
    color: string;
    alpha: number;
  }[];
}) {
  return (
    <Svg width={box} height={box} viewBox="0 0 100 100">
      <Defs>
        {masses.map((m, i) => (
          <RadialGradient key={i} id={`${id}-g${i}`} cx="50%" cy="50%" r="50%">
            <Stop
              offset="0"
              stopColor={m.color}
              stopOpacity={a(m.alpha, glass)}
            />
            <Stop
              offset="0.55"
              stopColor={m.color}
              stopOpacity={a(m.alpha * 0.45, glass)}
            />
            <Stop offset="1" stopColor={m.color} stopOpacity={0} />
          </RadialGradient>
        ))}
        <ClipPath id={`${id}-clip`}>
          <Ellipse cx="50" cy="50" rx="50" ry="50" />
        </ClipPath>
        <Filter id={`${id}-soft`}>
          <FeGaussianBlur stdDeviation="7" />
        </Filter>
      </Defs>
      <G clipPath={`url(#${id}-clip)`}>
        <G filter={`url(#${id}-soft)`}>
          {masses.map((m, i) => (
            <Ellipse
              key={i}
              cx={m.cx}
              cy={m.cy}
              rx={m.rx}
              ry={m.ry}
              fill={`url(#${id}-g${i})`}
            />
          ))}
        </G>
      </G>
    </Svg>
  );
}

/**
 * The Pluclair orb: a glass shell with gold clouds turning slowly inside it.
 *
 * It drifts again, and this time it can. The mark used to be a still render
 * of a lit ball with a fixed highlight, so turning it sent the highlight
 * orbiting the surface — a rendering fault, not a shine. Nothing here is
 * baked: the clouds are their own layers and turn on their own, while the
 * specular, the terminator and the bounce rim sit in a layer that never
 * moves, because a reflection belongs to the room rather than to the ball.
 *
 * Three layers, back to front: a circular blur that frosts whatever is
 * behind the orb, which is what makes it glass rather than a decal; the two
 * counter-turning cloud layers; and the optics on top.
 *
 * Rolling the whole ball survives for the loading indicator alone, where the
 * highlight is *meant* to travel — a gold ball rolling is the point, and the
 * logo is literally a ball that rolls.
 */
export function Orb({
  size = "nav",
  spin = "none",
  className,
  style,
  ...props
}: OrbProps) {
  const box = BOX[size];
  const glass = GLASS[size];
  /* Gradient and clip ids have to be unique per instance, not per size. A
     header mark and a loading orb are on screen together — the Screen band
     keeps its mark while the body waits — and two documents declaring
     `orb-shell` leave which definition wins up to the platform. The colons
     React puts in a `useId` are not valid in a `url(#…)` reference. */
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const reduce = useReducedMotion();
  const rolling = spin !== "none" && !reduce;

  const drift = useSharedValue(0);
  const counterDrift = useSharedValue(0);
  const roll = useSharedValue(0);

  useEffect(() => {
    if (reduce) {
      drift.value = 0;
      counterDrift.value = 0;
      return;
    }
    const turn = (period: number, to: number) =>
      withRepeat(
        withTiming(to, { duration: period, easing: Easing.linear }),
        -1,
        false,
      );
    drift.value = 0;
    drift.value = turn(DRIFT_PERIOD, 360);
    counterDrift.value = 0;
    counterDrift.value = turn(COUNTER_DRIFT_PERIOD, -360);
  }, [reduce, drift, counterDrift]);

  useEffect(() => {
    if (!rolling) {
      roll.value = 0;
      return;
    }
    roll.value = 0;
    roll.value = withRepeat(
      withTiming(360, { duration: LOADING_PERIOD, easing: Easing.linear }),
      -1,
      false,
    );
  }, [rolling, roll]);

  const driftStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${drift.value}deg` }],
  }));
  const counterDriftStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${counterDrift.value}deg` }],
  }));
  const rollStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${roll.value}deg` }],
  }));

  const layer = { position: "absolute", width: box, height: box } as const;

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Pluclair"
      className={cn("items-center justify-center", className)}
      style={[{ width: box, height: box }, style]}
      {...props}
    >
      <Animated.View
        style={[{ width: box, height: box }, rollStyle]}
        pointerEvents="none"
      >
        {/* The frost, and the only layer that touches the pixels behind the
            orb — which is what makes this glass rather than a decal. Its
            strength follows the box, since a blur radius is in pixels and
            the same number cannot serve a 26px mark and a 320px watermark.
            Its own overlay tint is nearly nothing: the shell's colour is
            drawn in SVG above, and a second flat tint here would only grey
            the clouds down. */}
        <Blur
          amount={Math.round(Math.min(24, 8 + box / 12))}
          overlayColor="rgba(11,9,5,0.12)"
          style={{
            ...layer,
            borderRadius: box / 2,
            overflow: "hidden",
          }}
        />
        <Animated.View style={[layer, driftStyle]}>
          <CloudLayer
            box={box}
            glass={glass}
            id={`${uid}-a`}
            masses={[
              { cx: 34, cy: 32, rx: 30, ry: 23, color: C1, alpha: 0.3 },
              { cx: 70, cy: 58, rx: 24, ry: 31, color: C2, alpha: 0.32 },
            ]}
          />
        </Animated.View>
        <Animated.View style={[layer, counterDriftStyle]}>
          <CloudLayer
            box={box}
            glass={glass}
            id={`${uid}-b`}
            masses={[
              { cx: 50, cy: 76, rx: 36, ry: 20, color: C3, alpha: 0.12 },
              { cx: 28, cy: 60, rx: 22, ry: 22, color: C2, alpha: 0.2 },
            ]}
          />
        </Animated.View>
        <OrbOptics box={box} glass={glass} id={`${uid}-optics`} />
      </Animated.View>
    </View>
  );
}

/**
 * The shell and its optics, in one still layer above the clouds.
 *
 * The tint sits on top rather than under, which is both simpler — one Svg
 * instead of two — and right: this is glass in front of the clouds, so
 * looking through it should mute them slightly. It thickens towards the rim
 * the way a shell does when you look through its edge, and above it are the
 * hard specular where the light is, the smaller second one glass always
 * shows, and the bounce along the bottom where the ground throws light back
 * up at the sphere.
 */
function OrbOptics({
  box,
  glass,
  id,
}: {
  box: number;
  glass: number;
  id: string;
}) {
  return (
    <Svg
      width={box}
      height={box}
      viewBox="0 0 100 100"
      style={{ position: "absolute" }}
      pointerEvents="none"
    >
      <Defs>
        <RadialGradient id={`${id}-shell`} cx="62%" cy="27%" r="70%">
          <Stop offset="0" stopColor={C1} stopOpacity={a(0.1, glass)} />
          <Stop offset="0.4" stopColor={C2} stopOpacity={a(0.08, glass)} />
          <Stop offset="0.72" stopColor={C2} stopOpacity={a(0.13, glass)} />
          <Stop offset="1" stopColor={C3} stopOpacity={a(0.36, glass)} />
        </RadialGradient>
        <RadialGradient id={`${id}-spec`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#fffdf6" stopOpacity={a(0.72, glass)} />
          <Stop offset="0.5" stopColor="#fffaeb" stopOpacity={a(0.16, glass)} />
          <Stop offset="1" stopColor="#fffaeb" stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={`${id}-spec2`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#fffae8" stopOpacity={a(0.22, glass)} />
          <Stop offset="1" stopColor="#fffae8" stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={`${id}-bounce`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#ffedc2" stopOpacity={a(0.26, glass)} />
          <Stop offset="1" stopColor="#ffedc2" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse cx="50" cy="50" rx="50" ry="50" fill={`url(#${id}-shell)`} />
      {/* The bounce, under the speculars: light off the ground is diffuse and
          belongs behind anything sharp. */}
      <Ellipse cx="42" cy="86" rx="30" ry="14" fill={`url(#${id}-bounce)`} />
      <Ellipse cx="63" cy="22" rx="17" ry="12" fill={`url(#${id}-spec)`} />
      <Ellipse cx="37" cy="71" rx="7" ry="6" fill={`url(#${id}-spec2)`} />
      {/* The shell's own edge, catching light all the way round. A stroke
          rather than another gradient: at 26px the rim is one pixel wide and
          a gradient that thin resolves to nothing. */}
      <Ellipse
        cx="50"
        cy="50"
        rx="49.4"
        ry="49.4"
        fill="none"
        stroke="#fff4d6"
        strokeOpacity={a(0.34, glass)}
        strokeWidth={1.2}
      />
    </Svg>
  );
}
