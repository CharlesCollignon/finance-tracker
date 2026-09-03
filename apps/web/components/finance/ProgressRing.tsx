import { progressTone } from "@/lib/progress-tone";
import { cn } from "@/lib/utils";

interface ProgressRingProps {
  ratio: number;
  label: string;
  detail: string;
  /** Chart token to fill with, when the ring is not in a danger state. */
  colorVar?: string;
  /**
   * What filling the ring means. A cap is a limit — nearing it is a warning
   * and passing it is a problem. A goal is a target: nearing it is the whole
   * point, and colouring that red tells the user their savings are going
   * wrong.
   */
  meaning?: "limit" | "target";
  over?: boolean;
  size?: number;
  className?: string;
}

/**
 * Progress toward a limit.
 *
 * Plain SVG. This was an ECharts gauge, which meant every screen showing a
 * cap pulled a charting runtime to draw two arcs and a percentage — and the
 * landing page had already written a hand-drawn twin precisely to keep that
 * runtime off the marketing path, so the app was carrying both.
 *
 * Colour comes from CSS tokens through `stroke`, so it follows the theme with
 * no JavaScript reading computed styles and no re-render when the theme
 * flips. The old version subscribed to that and kept it in React state.
 */
export function ProgressRing({
  ratio,
  label,
  detail,
  colorVar = "--chart-1",
  meaning = "limit",
  over = false,
  size = 100,
  className,
}: ProgressRingProps) {
  const clamped = Math.min(1, Math.max(0, ratio));
  const danger =
    meaning === "limit" && progressTone(clamped, over) === "danger";
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          role="img"
          aria-label={`${label}: ${detail}`}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--hairline-strong)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={danger ? "var(--destructive)" : `var(${colorVar})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - clamped)}
          />
        </svg>
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center",
            "font-head text-lg tabular-nums",
            danger && "text-destructive",
          )}
        >
          {Math.round(clamped * 100)}%
        </span>
      </div>
      <span className="max-w-28 truncate text-sm font-medium">{label}</span>
      <span className="max-w-28 truncate text-xs text-muted-foreground">
        {detail}
      </span>
    </div>
  );
}
