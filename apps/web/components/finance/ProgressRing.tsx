import { progressTone } from "@/lib/progress-tone";
import { cn } from "@/lib/utils";

interface ProgressRingProps {
  ratio: number;
  label: string;
  detail: string;
  /**
   * Whether `detail` is an amount of the user's money, and so goes under the
   * privacy blur.
   *
   * Off by default because the Bearing's rings give a percentage there, and a
   * percentage of a cap the user set is not a figure worth covering. The Plan
   * screen's rings give "1 240 € of 1 500 €", which is.
   */
  money?: boolean;
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
  money = false,
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
          // Hidden from assistive technology rather than named. It carried
          // `aria-label={`${label}: ${detail}`}`, which said nothing the three
          // elements beside it do not already say in text — the percentage,
          // the label and the detail are all in the DOM — so a screen reader
          // heard every ring twice. Worse, when `detail` is money that second
          // reading was the one place the figure escaped the privacy blur:
          // CSS cannot reach into an accessible name, so a user who had
          // covered their figures still had them read out in full. The arcs
          // are a picture of the number under them.
          aria-hidden
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
      {/* Wide enough for "1 240 € of 1 500 €", which is what a cap's detail
          says on the Plan screen; anything longer is a category name, and
          truncating those is the intent. */}
      <span className="max-w-36 truncate text-sm font-medium">{label}</span>
      <span
        className={cn(
          "max-w-36 truncate text-xs text-muted-foreground",
          money && "privacy-amount",
        )}
      >
        {detail}
      </span>
    </div>
  );
}
