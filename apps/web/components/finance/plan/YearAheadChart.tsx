"use client";

import {
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import {
  resampleSeries,
  stackBands,
  type YearAhead,
  type YearAheadAccountId,
  type YearAheadEvent,
} from "@finance/core/year-ahead";
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";
import { MICRO } from "@/lib/type-scale";
import { cn } from "@/lib/utils";
import {
  EVENT_LINE_KEYS,
  EVENT_NAME_KEYS,
  EventIcon,
  FOLLOW,
  MORPH,
} from "./year-ahead-parts";

/** The plot's height in pixels; its width is whatever the card gives it. */
const HEIGHT = 232;
/** Room above and below, so an end dot or a marker's stem is not cut. */
const PAD_Y = 18;
/** The x axis in the SVG's own units, stretched to the card's width. */
const SPAN = 1000;
/**
 * Every path is drawn from this many points whatever the window — one per
 * month at five years — so six months can morph into five years.
 */
const SAMPLES = 61;

interface YearAheadChartProps {
  ahead: YearAhead;
  color: (id: YearAheadAccountId) => string;
  name: (id: YearAheadAccountId) => string;
  /** An account being pointed at elsewhere on the card: the others dim. */
  focus: YearAheadAccountId | null;
  /** Whether the reader's what-ifs move the figure, so the dashed line says from where. */
  showBaseline: boolean;
  events: readonly YearAheadEvent[];
  onMoveEvent: (id: string, month: number) => void;
  /** "Aujourd'hui", "mars 2027": a step said in full. */
  stepLabel: (step: number) => string;
  /** "mars 27": a step on the axis. */
  axisLabel: (step: number) => string;
  /** The steps where a year turns, for the long windows' ticks. */
  yearTicks: { step: number; label: string }[];
  format: (value: number) => string;
}

/**
 * The months ahead as one band per account, stacked, under the gold line of
 * their sum.
 *
 * Built the way the Bearing's balance curve is — relative units stretched to
 * the card, strokes held at their width, dots in HTML so they stay round —
 * and wiped in from the left as the card arrives. After that every change
 * morphs: an account taken out folds into the one below it, a new one rises
 * from its floor, a longer window stretches the bands instead of redrawing
 * them. The crosshair follows the pointer, a finger or the arrow keys to the
 * nearest month and reads every account out, to a screen reader as well; an
 * event's marker rides the line and is dragged from month to month.
 */
export function YearAheadChart({
  ahead,
  color,
  name,
  focus,
  showBaseline,
  events,
  onMoveEvent,
  stepLabel,
  axisLabel,
  yearTicks,
  format,
}: YearAheadChartProps) {
  const t = useT();
  const titleId = useId();
  const reduce = useReducedMotion() ?? false;
  const morph = reduce ? { duration: 0 } : MORPH;
  const follow = reduce ? { duration: 0 } : FOLLOW;
  const frameRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const months = ahead.months;
  const visible = useMemo(
    () => ahead.bands.filter((band) => !band.hidden),
    [ahead.bands],
  );

  const geometry = useMemo(() => {
    const stacked = stackBands(
      visible.map((band) => resampleSeries(band.values, SAMPLES)),
    );
    const total = resampleSeries(ahead.total, SAMPLES);
    const baseline = resampleSeries(ahead.baseline, SAMPLES);
    const values = [
      ...stacked.flatMap((band) => [...band.lower, ...band.upper]),
      ...total,
      ...(showBaseline ? baseline : []),
    ];
    let min = Math.min(0, ...values);
    let max = Math.max(0, ...values);
    if (max - min < 1) {
      max += 1;
      min -= 1;
    }
    const y = (value: number) =>
      PAD_Y + ((max - value) / (max - min)) * (HEIGHT - PAD_Y * 2);
    const x = (index: number) => (index / (SAMPLES - 1)) * SPAN;
    const line = (series: readonly number[]) =>
      series
        .map(
          (value, index) =>
            `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(value).toFixed(1)}`,
        )
        .join(" ");
    const area = (upper: readonly number[], lower: readonly number[]) => {
      const back = lower
        .map((value, index) => `L${x(index).toFixed(1)},${y(value).toFixed(1)}`)
        .reverse()
        .join(" ");
      return `${line(upper)} ${back} Z`;
    };
    return {
      y,
      bands: visible.map((band, index) => ({
        id: band.id,
        area: area(stacked[index]!.upper, stacked[index]!.lower),
        edge: line(stacked[index]!.upper),
        // Where a band rises from and folds back to: its own floor.
        flat: area(stacked[index]!.lower, stacked[index]!.lower),
        flatEdge: line(stacked[index]!.lower),
      })),
      total: line(total),
      baseline: line(baseline),
      zeroY: min < 0 && max > 0 ? y(0) : null,
    };
  }, [visible, ahead.total, ahead.baseline, showBaseline]);

  const percent = (step: number) =>
    `${((months > 0 ? step / months : 0) * 100).toFixed(3)}%`;

  function nearest(clientX: number, from = 0): number {
    const frame = frameRef.current;
    if (!frame || months === 0) {
      return from;
    }
    const rect = frame.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    return Math.min(months, Math.max(from, Math.round(ratio * months)));
  }

  function handleKey(event: KeyboardEvent<HTMLDivElement>) {
    const steps: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      Home: -months - 1,
      End: months + 1,
    };
    const step = steps[event.key];
    if (step === undefined) {
      return;
    }
    event.preventDefault();
    const start = active ?? (step > 0 ? -1 : months + 1);
    setActive(Math.min(months, Math.max(0, start + step)));
  }

  const shown = active !== null ? Math.min(active, months) : null;
  const readout =
    shown !== null
      ? `${stepLabel(shown)} · ${t("planWeb.scrubTotal")} ${format(ahead.total[shown] ?? 0)}`
      : "";
  // The tooltip lists the accounts top to bottom, as they are stacked.
  const stackedTopDown = [...visible].reverse();
  const placed = events.filter((event) => event.month <= months);

  return (
    <div>
      <div
        ref={frameRef}
        role="img"
        aria-labelledby={titleId}
        tabIndex={0}
        onPointerMove={(event: PointerEvent<HTMLDivElement>) => {
          if (!dragging) {
            setActive(nearest(event.clientX));
          }
        }}
        onPointerDown={(event: PointerEvent<HTMLDivElement>) =>
          setActive(nearest(event.clientX))
        }
        onPointerLeave={() => {
          if (!dragging) {
            setActive(null);
          }
        }}
        onBlur={() => setActive(null)}
        onKeyDown={handleKey}
        className={cn(
          "relative w-full touch-pan-y select-none rounded-control outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
        )}
        style={{ height: HEIGHT }}
      >
        <span id={titleId} className="sr-only">
          {t("planWeb.yearChartLabel")}
        </span>

        {/* The long windows' years, as faint ticks behind everything. */}
        {yearTicks.map((tick) => (
          <span
            key={tick.step}
            aria-hidden
            className="pointer-events-none absolute inset-y-2 w-px bg-hairline"
            style={{ left: percent(tick.step) }}
          />
        ))}

        <svg
          viewBox={`0 0 ${SPAN} ${HEIGHT}`}
          preserveAspectRatio="none"
          className="balance-curve-draw absolute inset-0 h-full w-full overflow-visible"
          aria-hidden
        >
          {geometry.zeroY !== null ? (
            <line
              x1={0}
              x2={SPAN}
              y1={geometry.zeroY}
              y2={geometry.zeroY}
              stroke="var(--hairline-strong)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ) : null}

          <AnimatePresence initial={false}>
            {geometry.bands.map((band) => {
              const dim = focus !== null && focus !== band.id;
              return (
                <m.g
                  key={band.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: dim ? 0.22 : 1 }}
                  exit={{ opacity: 0 }}
                  transition={morph}
                >
                  <m.path
                    initial={{ d: band.flat }}
                    animate={{ d: band.area }}
                    exit={{ d: band.flat }}
                    transition={morph}
                    fill={color(band.id)}
                    fillOpacity={0.38}
                  />
                  <m.path
                    initial={{ d: band.flatEdge }}
                    animate={{ d: band.edge }}
                    exit={{ d: band.flatEdge }}
                    transition={morph}
                    fill="none"
                    stroke={color(band.id)}
                    strokeWidth={1.25}
                    vectorEffect="non-scaling-stroke"
                  />
                </m.g>
              );
            })}
          </AnimatePresence>

          <AnimatePresence>
            {showBaseline ? (
              <m.path
                key="baseline"
                initial={{ opacity: 0, d: geometry.baseline }}
                animate={{ opacity: 0.85, d: geometry.baseline }}
                exit={{ opacity: 0 }}
                transition={morph}
                fill="none"
                stroke="var(--foreground)"
                strokeWidth={1.5}
                strokeDasharray="5 5"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
          </AnimatePresence>

          <m.path
            initial={false}
            animate={{ d: geometry.total }}
            transition={morph}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={2.25}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* Today, and where it ends: the end in gold, being the figure. */}
        <Dot
          left={percent(0)}
          top={geometry.y(ahead.total[0] ?? 0)}
          className="balance-curve-fade size-2 bg-foreground/70"
          transition={morph}
        />
        <Dot
          left={percent(months)}
          top={geometry.y(ahead.total[months] ?? 0)}
          className="balance-curve-fade size-2.5 bg-primary"
          transition={morph}
        />

        <AnimatePresence>
          {shown !== null ? (
            <m.div
              key="scrub"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.15 }}
              className="pointer-events-none absolute inset-0"
            >
              <m.span
                aria-hidden
                initial={false}
                animate={{ left: percent(shown) }}
                transition={follow}
                className="absolute inset-y-1 w-px bg-hairline-strong"
              />
              <Dot
                left={percent(shown)}
                top={geometry.y(ahead.total[shown] ?? 0)}
                className="size-3 bg-primary"
                transition={follow}
              />
              <m.div
                aria-hidden
                initial={false}
                animate={{
                  left: percent(shown),
                  x:
                    shown / Math.max(1, months) < 0.2
                      ? "0%"
                      : shown / Math.max(1, months) > 0.8
                        ? "-100%"
                        : "-50%",
                }}
                transition={follow}
                className="absolute top-0 z-10 min-w-44 rounded-control border border-foreground/10 bg-popover px-3 py-2 text-left"
              >
                <p className={cn(MICRO, "text-muted-foreground")}>
                  {stepLabel(shown)}
                </p>
                <p className="privacy-sensitive text-sm font-semibold tabular-nums text-primary-ink">
                  {format(ahead.total[shown] ?? 0)}
                </p>
                <ul className="mt-1 flex flex-col gap-0.5">
                  {stackedTopDown.map((band) => (
                    <li
                      key={band.id}
                      className="flex items-center justify-between gap-3 text-xs"
                    >
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <span
                          aria-hidden
                          className="size-2 rounded-full"
                          style={{ background: color(band.id) }}
                        />
                        {name(band.id)}
                      </span>
                      <span className="privacy-sensitive tabular-nums">
                        {format(band.values[shown] ?? 0)}
                      </span>
                    </li>
                  ))}
                </ul>
              </m.div>
            </m.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {placed.map((event) => (
            <EventMarker
              key={event.id}
              event={event}
              left={percent(event.month)}
              top={geometry.y(ahead.total[event.month] ?? 0)}
              label={t("futurePlan.eventMarker", {
                name: t(EVENT_NAME_KEYS[event.kind]),
                line: t(EVENT_LINE_KEYS[event.kind], {
                  amount: format(event.amount),
                  month: stepLabel(event.month),
                }),
              })}
              reduce={reduce}
              onDragStart={() => {
                setDragging(event.id);
                setActive(event.month);
              }}
              onDrag={(clientX) => {
                const month = nearest(clientX, 1);
                setActive(month);
                if (month !== event.month) {
                  onMoveEvent(event.id, month);
                }
              }}
              onDragEnd={() => {
                setDragging(null);
                setActive(null);
              }}
              onStep={(delta) =>
                onMoveEvent(
                  event.id,
                  Math.min(months, Math.max(1, event.month + delta)),
                )
              }
            />
          ))}
        </AnimatePresence>
      </div>

      <p className="sr-only" aria-live="polite">
        {readout}
      </p>

      <div className="relative mt-2 h-4 text-xs text-muted-foreground">
        <span className="absolute left-0">{axisLabel(0)}</span>
        {yearTicks.map((tick) => (
          <span
            key={tick.step}
            aria-hidden
            className="absolute hidden -translate-x-1/2 sm:inline"
            style={{ left: percent(tick.step) }}
          >
            {tick.label}
          </span>
        ))}
        <span className="absolute right-0">{axisLabel(months)}</span>
      </div>

      <table className="sr-only">
        <thead>
          <tr>
            <th scope="col">{t("planWeb.tableMonth")}</th>
            {visible.map((band) => (
              <th key={band.id} scope="col">
                {name(band.id)}
              </th>
            ))}
            <th scope="col">{t("planWeb.scrubTotal")}</th>
          </tr>
        </thead>
        <tbody>
          {ahead.total.map((total, step) => (
            <tr key={step}>
              <th scope="row">{stepLabel(step)}</th>
              {visible.map((band) => (
                <td key={band.id}>{format(band.values[step] ?? 0)}</td>
              ))}
              <td>{format(total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * An event riding the line at its month. Dragged sideways it hops from month
 * to month, the bands following; the arrow keys do the same.
 */
function EventMarker({
  event,
  left,
  top,
  label,
  reduce,
  onDragStart,
  onDrag,
  onDragEnd,
  onStep,
}: {
  event: YearAheadEvent;
  left: string;
  top: number;
  label: string;
  reduce: boolean;
  onDragStart: () => void;
  onDrag: (clientX: number) => void;
  onDragEnd: () => void;
  onStep: (delta: number) => void;
}) {
  const [held, setHeld] = useState(false);
  const tone =
    event.kind === "expense"
      ? "border-destructive/50 text-destructive"
      : "border-primary/50 text-primary-ink";

  return (
    <m.button
      type="button"
      aria-label={label}
      initial={{ opacity: 0, scale: 0.4, left, top }}
      animate={{ opacity: 1, scale: held ? 1.15 : 1, left, top }}
      exit={{ opacity: 0, scale: 0.4 }}
      whileHover={reduce ? undefined : { scale: 1.1 }}
      transition={reduce ? { duration: 0 } : FOLLOW}
      onPointerDown={(pointer) => {
        pointer.stopPropagation();
        pointer.currentTarget.setPointerCapture(pointer.pointerId);
        setHeld(true);
        onDragStart();
      }}
      onPointerMove={(pointer) => {
        pointer.stopPropagation();
        if (held) {
          onDrag(pointer.clientX);
        }
      }}
      onPointerUp={(pointer) => {
        pointer.stopPropagation();
        pointer.currentTarget.releasePointerCapture(pointer.pointerId);
        setHeld(false);
        onDragEnd();
      }}
      onPointerCancel={() => {
        setHeld(false);
        onDragEnd();
      }}
      onKeyDown={(key) => {
        if (key.key === "ArrowLeft" || key.key === "ArrowRight") {
          key.preventDefault();
          key.stopPropagation();
          onStep(key.key === "ArrowLeft" ? -1 : 1);
        }
      }}
      className={cn(
        "absolute z-20 flex size-8 -translate-x-1/2 -translate-y-[calc(100%_+_10px)] cursor-grab touch-none items-center justify-center rounded-full border bg-popover active:cursor-grabbing",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        tone,
      )}
    >
      <EventIcon kind={event.kind} size={ICON.sm} />
      {/* The stem, down to the line. */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-full h-2.5 w-px -translate-x-1/2 bg-current opacity-60"
      />
    </m.button>
  );
}

function Dot({
  left,
  top,
  className,
  transition,
}: {
  left: string;
  top: number;
  className?: string;
  transition: object;
}) {
  return (
    <m.span
      aria-hidden
      initial={false}
      animate={{ left, top }}
      transition={transition}
      className={cn(
        "pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card",
        className,
      )}
    />
  );
}
