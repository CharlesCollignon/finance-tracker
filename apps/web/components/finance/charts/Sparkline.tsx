interface SparklineProps {
  /** Oldest first. Two points draw a line; fewer draws nothing. */
  values: number[];
  width?: number;
  height?: number;
  /** Chart token to stroke with. */
  colorVar?: string;
  className?: string;
}

/**
 * The shape of the run, beside the figure it belongs to.
 *
 * No axis, no grid, no labels — the number next to it is the value, and this
 * only has to say which way it has been going. The last point is marked
 * because that is the one the figure states; without the dot the eye reads the
 * peak instead of the end.
 *
 * Plain SVG, and the colour arrives through `stroke` as a CSS token, so this
 * renders on the server and follows the theme with no JavaScript reading
 * computed styles. That is the same bargain the other three marks make — see
 * the note in `charts/index.ts`.
 *
 * Hidden from assistive technology on purpose. It restates the direction of a
 * figure that is already announced beside it, and a screen reader has nothing
 * useful to say about a path with no scale.
 */
export function Sparkline({
  values,
  width = 72,
  height = 24,
  colorVar = "--primary",
  className,
}: SparklineProps) {
  if (values.length < 2) {
    return null;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  // A flat run has no span to scale against, so it draws down the middle
  // rather than dividing by zero and collapsing onto the top edge.
  const span = max - min || 1;
  const inset = 2;
  const usable = height - inset * 2;

  const points = values.map((value, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = inset + (1 - (value - min) / span) * usable;
    return [x, y] as const;
  });

  const d = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const [lastX, lastY] = points[points.length - 1]!;
  const stroke = `var(${colorVar})`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
      focusable="false"
      className={className}
    >
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lastX} cy={lastY} r={2.2} fill={stroke} />
    </svg>
  );
}
