"use client";

import { useId } from "react";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import type {
  ForwardProjection,
  ProjectionIngredient,
  ProjectionPoint,
  Runway,
} from "@finance/core/projection";
import { formatRunway } from "@finance/core/projection";
import { Card } from "@/components/retroui/Card";
import { ICON } from "@/lib/icon-scale";
import { useFormatCurrency } from "@/lib/use-currency";
import { useLocale, useT } from "@/lib/locale-context";
import { cn } from "@/lib/utils";

interface ProjectionCardProps {
  projection: ForwardProjection;
  runway: Runway;
}

/** Where each ingredient is edited. Kept out of core: mobile's routes differ. */
const INGREDIENT_HREF: Record<ProjectionIngredient["kind"], string> = {
  income: "/recurring",
  committed: "/recurring",
  "set-aside": "/recurring",
  deployed: "/investments",
  unrecorded: "/budgets",
};

/**
 * Where the months ahead lead.
 *
 * Two figures rather than one. A single line answering "what will the
 * account hold" counted every euro moved into savings or a wallet as money
 * gone, so a diligent saver watched it sink; the second line is that plus
 * everything set aside, and the gap between them is what has been put by.
 *
 * Still arithmetic rather than a forecast — which is why it says "if nothing
 * changes" and why the market is nowhere in it. The one figure here that was
 * not scheduled by the user is their unrecorded spending, and that is
 * measured from closed months rather than guessed, which the card says out
 * loud rather than asking to be trusted.
 *
 * The ingredients are not decoration either. This card's real failure was
 * arriving at a number with no way to see what was missing from it: someone
 * whose pay is not a charge got a line sliding downhill and no reason for
 * it. Now they get the reason first.
 */
export function ProjectionCard({ projection, runway }: ProjectionCardProps) {
  const locale = useLocale();
  const t = useT();
  const formatEuro = useFormatCurrency();

  const { points, summary, makeup } = projection;
  const runwayLine = formatRunway(runway, locale);

  if (!summary) {
    return null;
  }

  const count = points.length;
  const period = summary.grounded
    ? t("projection.by", { month: summary.endLabel })
    : t("projection.added", { count });

  return (
    <Card.Bezel className="w-full" innerClassName="p-5 md:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-head text-base">{t("projection.heading")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("projection.window", { count })}
        </p>
      </div>

      {/* Above the figures, because it invalidates them. A caveat printed
          under a number nobody should be reading is a caveat that arrives
          too late. */}
      {makeup.noIncomeScheduled ? (
        <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
          {t("projection.noIncomeCharge")}{" "}
          <Link
            href="/recurring"
            className="font-medium underline underline-offset-2"
          >
            {t("projection.noIncomeCta")}
          </Link>
        </p>
      ) : null}

      {/* The two figures are the chart's legend. A separate legend row would
          restate them and take a line doing it. */}
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <Figure
          label={t("projection.kept")}
          value={formatEuro(
            summary.grounded ? summary.endingKept : summary.addedAltogether,
          )}
          period={period}
          tone={summary.shrinking ? "bad" : "good"}
          swatch="bg-primary"
          lead
        />
        <Figure
          label={t("projection.inAccounts")}
          value={formatEuro(
            summary.grounded ? summary.endingOnHand : summary.addedToAccounts,
          )}
          period={period}
          tone="plain"
          swatch="bg-muted-foreground"
        />
      </div>

      {!summary.grounded ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {t("projection.noOpeningBalance")}
        </p>
      ) : null}

      <ProjectionSparkline points={points} />

      <p className="mt-3 text-sm text-muted-foreground">
        <span className="tabular-nums">
          {t("projection.perMonth", {
            amount: `${summary.monthlyToAccounts >= 0 ? "+" : "−"}${formatEuro(
              Math.abs(summary.monthlyToAccounts),
            )}`,
          })}
        </span>
        {summary.shrinking ? ` · ${t("projection.shrinking")}` : null}
        {!summary.shrinking && summary.accountsFalling
          ? ` · ${t("projection.accountsFalling", {
              amount: formatEuro(
                Math.abs(summary.monthlyAltogether - summary.monthlyToAccounts),
              ),
            })}`
          : null}
      </p>

      <div className="mt-4 border-t border-border pt-4">
        <p className="text-sm font-medium">{t("projection.madeOf")}</p>
        <ul className="mt-2 flex flex-col">
          {makeup.ingredients.map((ingredient) => (
            <Ingredient key={ingredient.kind} ingredient={ingredient} />
          ))}
        </ul>
      </div>

      {runwayLine ? (
        <p className="mt-4 border-t border-border pt-4 text-sm">
          <span className="text-muted-foreground">{t("plan.runwayLead")} </span>
          <span className="font-medium tabular-nums text-foreground">
            {runwayLine.replace(/\.$/, "")}
          </span>
          <span className="text-muted-foreground">
            {" "}
            {t("plan.runwayRate", {
              amount: formatEuro(runway.monthlyCommitted),
            })}
          </span>
        </p>
      ) : null}
    </Card.Bezel>
  );
}

function Figure({
  label,
  value,
  period,
  tone,
  swatch,
  lead = false,
}: {
  label: string;
  value: string;
  period: string;
  tone: "good" | "bad" | "plain";
  swatch: string;
  lead?: boolean;
}) {
  return (
    <div>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <span
          aria-hidden
          className={cn("inline-block h-2 w-2 rounded-full", swatch)}
        />
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-serif font-semibold tabular-nums",
          lead ? "text-3xl md:text-4xl" : "text-2xl md:text-3xl",
          tone === "bad" && "text-destructive",
          tone === "good" && "text-primary-ink",
        )}
      >
        <span className="privacy-amount">{value}</span>
      </p>
      <p className="mt-0.5 text-sm text-muted-foreground">{period}</p>
    </div>
  );
}

/**
 * One ingredient, and where it is edited.
 *
 * A link rather than a row of text: every one of these is something the user
 * can change, and the whole reason the card lists them is so that a missing
 * salary or a forgotten subscription is one press from being fixed.
 */
function Ingredient({ ingredient }: { ingredient: ProjectionIngredient }) {
  const t = useT();
  const formatEuro = useFormatCurrency();

  const label = {
    income: t("projection.income"),
    committed: t("projection.committed"),
    "set-aside": t("projection.setAside"),
    deployed: t("projection.deployed"),
    unrecorded: t("projection.unrecorded"),
  }[ingredient.kind];

  const backing =
    ingredient.kind === "unrecorded"
      ? ingredient.counted
        ? t("projection.unrecordedMeasured", { count: ingredient.closes })
        : t("projection.unrecordedNotYet")
      : ingredient.charges > 0
        ? t("projection.charges", { count: ingredient.charges })
        : t("projection.noCharges");

  const note =
    ingredient.kind === "set-aside"
      ? t("projection.setAsideNote")
      : ingredient.kind === "deployed"
        ? t("projection.deployedNote")
        : null;

  // Income adds; everything else takes away. `deployed` does neither — it
  // moved inside a wallet — so it gets no sign at all.
  const sign =
    ingredient.kind === "income"
      ? "+"
      : ingredient.kind === "deployed"
        ? ""
        : "−";

  return (
    <li>
      <Link
        href={INGREDIENT_HREF[ingredient.kind]}
        className="-mx-2 flex items-baseline justify-between gap-3 rounded-md px-2 py-2 hover:bg-accent"
      >
        <span className="min-w-0">
          <span className="text-sm">{label}</span>{" "}
          <span className="text-xs text-muted-foreground">
            {backing}
            {note ? ` · ${note}` : null}
          </span>
        </span>
        <span className="flex shrink-0 items-baseline gap-1.5">
          <span className="privacy-amount text-sm tabular-nums">
            {sign}
            {formatEuro(ingredient.monthly)}
          </span>
          <ArrowRight
            size={ICON.sm}
            aria-hidden
            className="translate-y-0.5 text-muted-foreground"
          />
        </span>
      </Link>
    </li>
  );
}

/**
 * Both tracks, on one scale.
 *
 * Hand-drawn rather than pulled from the chart library because it carries
 * two series and no axes — loading ECharts for twenty-four points would cost
 * more than the picture is worth. The accounts keep the filled area they had;
 * everything kept is a second stroke above it, dashed so the two are told
 * apart without colour alone.
 *
 * A zero baseline appears whenever the scale reaches below it, which
 * subtracting unrecorded spending now makes reachable.
 */
function ProjectionSparkline({ points }: { points: ProjectionPoint[] }) {
  const gradientId = useId();

  if (points.length < 2) {
    return null;
  }

  const width = 100;
  const height = 28;
  const values = [
    ...points.map((point) => point.onHand),
    ...points.map((point) => point.kept),
  ];
  const min = Math.min(0, ...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const y = (value: number) => height - ((value - min) / span) * height;
  const path = (pick: (point: ProjectionPoint) => number) =>
    `M${points
      .map(
        (point, index) =>
          `${((index / (points.length - 1)) * width).toFixed(2)},${y(
            pick(point),
          ).toFixed(2)}`,
      )
      .join(" L")}`;

  const accounts = path((point) => point.onHand);
  const kept = path((point) => point.kept);
  const last = points[points.length - 1]!;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Projected accounts and total kept over ${points.length} months`}
      className="mt-4 h-16 w-full text-primary"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      {min < 0 ? (
        <line
          x1="0"
          x2={width}
          y1={y(0)}
          y2={y(0)}
          stroke="currentColor"
          strokeOpacity="0.25"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      <path
        d={`${accounts} L${width},${height} L0,${height} Z`}
        fill={`url(#${gradientId})`}
      />
      <path
        d={accounts}
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={kept}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="3 2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={width}
        cy={y(last.kept)}
        r="2"
        fill="currentColor"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
