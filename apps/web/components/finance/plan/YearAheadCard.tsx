"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AnimatePresence,
  LazyMotion,
  m,
  MotionConfig,
  useReducedMotion,
} from "motion/react";
import { ArrowRight, CalendarCheck } from "@phosphor-icons/react";
import { formatMonthCompact } from "@finance/core/constants";
import type { Envelope } from "@finance/core/future-plan";
import type { ForwardProjection } from "@finance/core/projection";
import {
  buildYearAhead,
  YEAR_AHEAD_EVENT_DEFAULTS,
  YEAR_AHEAD_HORIZONS,
  type YearAheadAccountId,
  type YearAheadEvent,
  type YearAheadEventKind,
  type YearAheadHorizon,
  type YearAheadSettings,
} from "@finance/core/year-ahead";
import { AnimatedAmount } from "@/components/finance/AnimatedAmount";
import { Button, ButtonNub } from "@/components/ui/Button";
import { GLASS_HERO } from "@/lib/glass";
import { ICON } from "@/lib/icon-scale";
import { useLocale, useT } from "@/lib/locale-context";
import { FIGURE_HERO, MICRO } from "@/lib/type-scale";
import { useFormatCurrency } from "@/lib/use-currency";
import { cn } from "@/lib/utils";
import { PlanCard } from "./plan-controls";
import { accountColors, accountNameKey, FOLLOW } from "./year-ahead-parts";
import { YearAheadChart } from "./YearAheadChart";
import { YearAheadWhatIf } from "./YearAheadWhatIf";
import { YearAheadWhy } from "./YearAheadWhy";

/** Motion's layout engine, fetched after the page — see `lib/motion-features`. */
const loadMotionFeatures = () =>
  import("@/lib/motion-features").then((mod) => mod.default);

interface YearAheadCardProps {
  projection: ForwardProjection;
  hasTemplates: boolean;
  /** The savings accounts and wallets, from the user's own figures. */
  envelopes: readonly Envelope[];
  /** The wallets' market value is still on its way. */
  pending: boolean;
  settings: YearAheadSettings;
  onSettingsChange: (next: YearAheadSettings) => void;
  /** Where « Et si… » goes, already checked against the accounts there are. */
  target: YearAheadAccountId;
  extra: number;
  onExtraChange: (extra: number) => void;
  /**
   * What the extra does to the next milestone. A slot rather than a string:
   * it needs the investment accounts' market value, which streams in after
   * the card, so it arrives inside its own Suspense boundary.
   */
  milestoneLine: ReactNode;
}

/**
 * The months ahead: the page's headline figure, where that money will be,
 * and why — with the controls that are pure play.
 *
 * The figure is every account added up at the end of the window: the
 * current account walked forward by the recurring entries, each savings
 * account and wallet growing by what goes in and what it earns. The chart
 * stacks them as bands under the gold line of their sum, and the legend
 * under it takes any of them out. Under that, one panel at a time:
 * « Pourquoi » cuts a month's income into where it goes; « Et si… » aims an
 * extra at one account and adds the events the recurring entries cannot
 * know, each a marker that rides the line.
 */
export function YearAheadCard(props: YearAheadCardProps) {
  const t = useT();
  if (
    !props.hasTemplates ||
    !props.projection.summary ||
    props.projection.points.length < 2
  ) {
    return (
      <PlanCard
        icon={<CalendarCheck size={ICON.sm} weight="fill" />}
        title={t("futurePlan.yearTitle")}
        className={GLASS_HERO}
      >
        <p className="text-sm text-muted-foreground">
          {t("planWeb.yearEmpty")}
        </p>
        <Button
          variant="pill"
          className="gap-3 self-start"
          render={<Link href="/recurring" />}
        >
          {t("planWeb.yearEmptyCta")}
          <ButtonNub>
            <ArrowRight size={ICON.md} />
          </ButtonNub>
        </Button>
      </PlanCard>
    );
  }
  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <MotionConfig reducedMotion="user">
        <YearAhead {...props} />
      </MotionConfig>
    </LazyMotion>
  );
}

function YearAhead({
  projection,
  envelopes,
  pending,
  settings,
  onSettingsChange,
  target,
  extra,
  onExtraChange,
  milestoneLine,
}: YearAheadCardProps) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const money = (value: number) => format(Math.round(value));
  const [focus, setFocus] = useState<YearAheadAccountId | null>(null);
  // « Pourquoi » or « Et si… »: one at a time, so the card reads calmly.
  const [panel, setPanel] = useState<"why" | "whatIf">("why");

  const { points, opening, makeup, summary } = projection;
  const grounded = opening.onHand !== null;

  // Never every account hidden: a card with nothing on it explains nothing.
  const ahead = useMemo(() => {
    const build = (hidden: readonly YearAheadAccountId[]) =>
      buildYearAhead({
        points,
        onHandToday: opening.onHand,
        envelopes,
        horizon: settings.horizon,
        extra: { monthly: extra, to: target },
        events: settings.events,
        hidden,
        complete: !pending,
      });
    const built = build(settings.hidden);
    return built.bands.every((band) => band.hidden) ? build([]) : built;
  }, [points, opening.onHand, envelopes, settings, extra, target, pending]);

  // What the extra alone adds: the figure with it, against the figure
  // without it, events and all, on the same accounts.
  const withoutExtra = useMemo(
    () =>
      extra > 0
        ? buildYearAhead({
            points,
            onHandToday: opening.onHand,
            envelopes,
            horizon: settings.horizon,
            events: settings.events,
            hidden: ahead.bands
              .filter((band) => band.hidden)
              .map((band) => band.id),
            complete: !pending,
          })
        : null,
    [points, opening.onHand, envelopes, settings, extra, ahead.bands, pending],
  );

  const months = ahead.months;
  const color = useMemo(() => accountColors(envelopes), [envelopes]);
  const name = (id: YearAheadAccountId) => t(accountNameKey(id));
  const stepLabel = (step: number) =>
    step === 0 ? t("futurePlan.today") : (points[step - 1]?.label ?? "");
  const axisLabel = (step: number) => {
    if (step === 0) {
      return t("futurePlan.today");
    }
    const point = points[step - 1];
    return point ? formatMonthCompact(point.year, point.month, locale) : "";
  };
  // A tick where each year turns, once the window is long enough to need it,
  // and never on top of the labels at either end.
  const yearTicks =
    months >= 24
      ? points
          .slice(0, months - 1)
          .flatMap((point, index) =>
            point.month === 1 &&
            index + 1 >= months * 0.1 &&
            index + 1 <= months * 0.9
              ? [{ step: index + 1, label: String(point.year) }]
              : [],
          )
      : [];

  const end = ahead.total[months] ?? 0;
  const played = ahead.total.some(
    (value, step) => Math.abs(value - (ahead.baseline[step] ?? 0)) >= 1,
  );
  const someHidden = ahead.bands.some((band) => band.hidden);
  const endLabel = points[months - 1]?.label ?? summary?.endLabel ?? "";

  const title =
    settings.horizon < 12
      ? t("futurePlan.inMonthsTitle", { count: settings.horizon })
      : t("futurePlan.inYearsTitle", { count: settings.horizon / 12 });

  const extraGain = withoutExtra ? end - (withoutExtra.total[months] ?? 0) : 0;

  /* ------------------------------------------------ the settings' moves */

  const update = (patch: Partial<YearAheadSettings>) =>
    onSettingsChange({ ...settings, ...patch });

  const toggle = (id: YearAheadAccountId) => {
    const hidden = settings.hidden.includes(id)
      ? settings.hidden.filter((other) => other !== id)
      : [...settings.hidden, id];
    update({ hidden });
  };

  const addEvent = (kind: YearAheadEventKind) => {
    const event: YearAheadEvent = {
      id: `${kind}-${Date.now().toString(36)}`,
      kind,
      amount: YEAR_AHEAD_EVENT_DEFAULTS[kind],
      month: Math.max(1, Math.ceil(months / 2)),
    };
    // An event lands on the current account, so it has to be on the chart.
    update({
      events: [...settings.events, event],
      hidden: settings.hidden.filter((id) => id !== "current"),
    });
  };

  const changeEvent = (id: string, patch: Partial<YearAheadEvent>) =>
    update({
      events: settings.events.map((event) =>
        event.id === id ? { ...event, ...patch } : event,
      ),
    });

  const targets: YearAheadAccountId[] = [
    ...envelopes.map((envelope) => envelope.id),
    "current",
  ];

  return (
    <PlanCard
      icon={<CalendarCheck size={ICON.sm} weight="fill" />}
      title={title}
      aside={
        <Segmented
          label={t("futurePlan.horizon")}
          options={YEAR_AHEAD_HORIZONS.map((horizon) => ({
            value: horizon,
            label:
              horizon < 12
                ? t("futurePlan.horizonMonths", { count: horizon })
                : t("futurePlan.years", { count: horizon / 12 }),
          }))}
          value={settings.horizon}
          onChange={(horizon: YearAheadHorizon) => update({ horizon })}
        />
      }
      className={cn(GLASS_HERO, "md:p-8")}
    >
      {/* Above the figure, because it invalidates it. */}
      {makeup.noIncomeScheduled ? (
        <p className="rounded-control border border-destructive/40 bg-destructive/10 p-3 text-sm">
          {t("projection.noIncomeCharge")}{" "}
          <Link
            href="/recurring"
            className="font-medium underline underline-offset-2"
          >
            {t("projection.noIncomeCta")}
          </Link>
        </p>
      ) : null}

      <div>
        <AnimatedAmount
          value={end}
          format={money}
          className={cn(FIGURE_HERO, "block text-primary-ink")}
        />
        <p className="mt-2 text-sm text-muted-foreground">
          {someHidden
            ? t("futurePlan.yearShownOnly", { month: endLabel })
            : grounded
              ? t("futurePlan.yearAllGrounded", { month: endLabel })
              : t("futurePlan.yearAllAdded", { month: endLabel })}
        </p>
      </div>

      <YearAheadChart
        ahead={ahead}
        color={color}
        name={name}
        focus={focus}
        showBaseline={played}
        events={settings.events}
        onMoveEvent={(id, month) => changeEvent(id, { month })}
        stepLabel={stepLabel}
        axisLabel={axisLabel}
        yearTicks={yearTicks}
        format={money}
      />

      <Legend
        bands={ahead.bands}
        months={months}
        pending={pending}
        played={played}
        color={color}
        name={name}
        onToggle={toggle}
        onFocus={setFocus}
        format={money}
      />
      {!grounded ? (
        <p className={cn(MICRO, "-mt-2 text-muted-foreground")}>
          {t("futurePlan.currentNoBank")}
        </p>
      ) : null}

      <div className="flex flex-col gap-4 border-t border-border pt-5">
        <Segmented
          label={t("futurePlan.detailsLabel")}
          options={[
            { value: "why", label: t("futurePlan.whyTitle") },
            { value: "whatIf", label: t("futurePlan.whatIfTitle") },
          ]}
          value={panel}
          onChange={(next) => {
            setFocus(null);
            setPanel(next);
          }}
          className="self-start"
        />
        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={panel}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            // A line the eye can follow from a label to its amount.
            className="max-w-2xl"
          >
            {panel === "why" ? (
              <YearAheadWhy
                flow={ahead.flow}
                everydayCounted={summary?.unrecordedCounted ?? false}
                endLabel={endLabel}
                color={color}
                name={name}
                onFocus={setFocus}
                format={format}
              />
            ) : (
              <YearAheadWhatIf
                extra={extra}
                onExtraChange={onExtraChange}
                targets={targets}
                target={target}
                onTarget={(id) =>
                  update({
                    to: id,
                    hidden: settings.hidden.filter((other) => other !== id),
                  })
                }
                result={
                  extra > 0
                    ? t("futurePlan.whatIfResultBy", {
                        amount: money(extraGain),
                        month: endLabel,
                      })
                    : null
                }
                milestoneLine={milestoneLine}
                events={settings.events}
                onAddEvent={addEvent}
                onChangeEvent={changeEvent}
                onRemoveEvent={(id) =>
                  update({
                    events: settings.events.filter((event) => event.id !== id),
                  })
                }
                onClear={() => {
                  onExtraChange(0);
                  update({ events: [] });
                }}
                monthOptions={points.map((point, index) => ({
                  month: index + 1,
                  label: point.label,
                }))}
                months={months}
                color={color}
                name={name}
                format={format}
              />
            )}
          </m.div>
        </AnimatePresence>
      </div>
    </PlanCard>
  );
}

/* ------------------------------------------------------------ the pieces */

/**
 * A row of choices with a pill that slides to the one picked: the window,
 * and « Pourquoi » against « Et si… ».
 */
function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  const pillId = useId();
  const reduce = useReducedMotion() ?? false;
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("flex rounded-full border border-border p-0.5", className)}
    >
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative isolate min-h-9 rounded-full px-3 text-xs font-medium tabular-nums",
              "transition-colors duration-hover",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              on
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {on ? (
              <m.span
                layoutId={pillId}
                transition={reduce ? { duration: 0 } : FOLLOW}
                className="absolute inset-0 -z-10 rounded-full bg-muted"
              />
            ) : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * One chip per account: its colour, its name, what it holds at the end. A
 * press takes it out of the figure and the chart, another brings it back;
 * pointing at one lights its band. The last one showing cannot be taken out.
 */
function Legend({
  bands,
  months,
  pending,
  played,
  color,
  name,
  onToggle,
  onFocus,
  format,
}: {
  bands: ReturnType<typeof buildYearAhead>["bands"];
  months: number;
  pending: boolean;
  played: boolean;
  color: (id: YearAheadAccountId) => string;
  name: (id: YearAheadAccountId) => string;
  onToggle: (id: YearAheadAccountId) => void;
  onFocus: (id: YearAheadAccountId | null) => void;
  format: (value: number) => string;
}) {
  const t = useT();
  const reduce = useReducedMotion() ?? false;
  const shown = bands.filter((band) => !band.hidden).length;

  return (
    <ul className="flex flex-wrap gap-2">
      <AnimatePresence initial={false}>
        {bands.map((band) => {
          const last = !band.hidden && shown === 1;
          return (
            <m.li
              key={band.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={reduce ? { duration: 0 } : FOLLOW}
            >
              <m.button
                type="button"
                aria-pressed={!band.hidden}
                aria-label={t("futurePlan.accountToggle", {
                  name: name(band.id),
                })}
                disabled={last}
                whileTap={reduce || last ? undefined : { scale: 0.95 }}
                onClick={() => onToggle(band.id)}
                onPointerEnter={() => !band.hidden && onFocus(band.id)}
                onPointerLeave={() => onFocus(null)}
                onFocus={() => !band.hidden && onFocus(band.id)}
                onBlur={() => onFocus(null)}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-full border px-3 text-left text-sm lg:min-h-10",
                  "transition-colors duration-hover",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                  band.hidden
                    ? "border-dashed border-border text-muted-foreground hover:text-foreground"
                    : "border-border bg-muted/40 hover:bg-muted",
                  last && "cursor-default",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "size-2.5 shrink-0 rounded-full transition-transform duration-hover",
                    band.hidden && "scale-75 opacity-40",
                  )}
                  style={{ background: color(band.id) }}
                />
                <span className={cn(band.hidden && "line-through")}>
                  {name(band.id)}
                </span>
                {!band.hidden ? (
                  <AnimatedAmount
                    value={band.values[months] ?? 0}
                    format={format}
                    className="font-medium tabular-nums"
                  />
                ) : null}
              </m.button>
            </m.li>
          );
        })}
        {pending ? (
          <m.li
            key="pending"
            layout
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex min-h-11 animate-pulse items-center rounded-full border border-dashed border-border px-3 text-sm text-muted-foreground lg:min-h-10"
          >
            {t("futurePlan.accountsPending")}
          </m.li>
        ) : null}
        {played ? (
          <m.li
            key="baseline"
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex min-h-11 items-center gap-2 px-1 text-xs text-muted-foreground lg:min-h-10"
          >
            <span
              aria-hidden
              className="h-0 w-4 border-t-2 border-dashed border-foreground/85"
            />
            {t("planWeb.asItStands")}
          </m.li>
        ) : null}
      </AnimatePresence>
    </ul>
  );
}
