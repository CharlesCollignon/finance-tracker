import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import {
  buildBearingCards,
  type BearingCard,
  type CardFigure,
  type CardId,
} from "@finance/core/bearing-cards";
import type { BearingFacts } from "@finance/core/bearing-facts";
import { phoneHref } from "@finance/core/bearing-tiles";
import { DURATION, EASE_STANDARD } from "@finance/core/motion";
import type { SpineState } from "@finance/core/spine";
import type { Locale } from "@finance/core/i18n/locale";

import { Panel } from "@/components/bearing/Panel";
import { Spine } from "@/components/bearing/Spine";
import { Sparkline } from "@/components/charts";
import { PrivateAmount } from "@/components/PrivateAmount";
import { Card } from "@/components/ui/Card";
import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useT } from "@/providers/LocaleProvider";
import { ICON, TYPE } from "@/theme/tokens";
import { useThemeColors } from "@/theme/useThemeColors";

/**
 * The five cards, in `CARD_ORDER`, each opening where it stands.
 *
 * The phone's twin of `apps/web/components/finance/bearing/BearingCards.tsx`:
 * the same list from the same `buildBearingCards`, in the same order, with
 * the same names, the same rows and the same links. What differs is the
 * idiom, not the content — the web wraps each card in `BorderGlow` and
 * `SpotlightCard`, which are DOM and CSS (conic-gradient masks,
 * `mask-composite`) driven by a pointer this device does not have, so the
 * surface here is the app's own glass `Card` and neither effect is faked
 * under the same name.
 *
 * What this replaces is worth naming, because the shape is the argument. The
 * Bearing was twelve draggable tiles whose order a model chose and a reader
 * could overrule. Three separate mechanisms — an arrangement, a set of pins
 * and a twelve-slot template — each answered "which of these figures
 * matters?", and none of them could answer it for somebody who had not yet
 * told the app anything. Five cards, one per fact family, is short enough
 * that the question does not need answering: nothing is hidden behind a
 * ranking, so nothing has to be ranked.
 *
 * One card open at a time, and closed by default. Two open cards double the
 * height of an already tall screen and put two detail fetches in flight for
 * figures the reader has stopped looking at.
 *
 * The figures are formatted here and never upstream: the display currency
 * lives on this device, so `buildBearingCards` takes the formatter rather
 * than the amounts.
 */
export function BearingCards({
  facts,
  spine,
  trend,
  locale,
}: {
  facts: BearingFacts;
  /** The ring, drawn inside "Your run" — its flame is dropped, see below. */
  spine: SpineState;
  /** Recent months of net, for the figures that draw a run behind them. */
  trend: number[];
  locale: Locale;
}) {
  const formatMoney = useFormatCurrency();
  const [open, setOpen] = useState<CardId | null>(null);

  const cards = useMemo(
    () => buildBearingCards(facts, formatMoney, locale),
    [facts, formatMoney, locale],
  );

  return (
    <View>
      {cards.map((card) => (
        <CardView
          key={card.id}
          card={card}
          open={open === card.id}
          onToggle={() =>
            setOpen((current) => (current === card.id ? null : card.id))
          }
          // The ring belongs to the run, so it is that card's content rather
          // than the screen's chrome.
          //
          // Load-bearing and worth saying out loud: the ring is drawn only if
          // a `run` card exists, and `buildBearingCards` silently drops a
          // family with no figures. The run family is non-empty today only
          // because `monthly-net-average` is always in the pack, which is
          // itself only true because `bucketMonthlyTrend` pre-seeds six month
          // buckets. If that ever stops holding, the ring disappears with no
          // error anywhere — the card it lives on will simply not be there.
          spine={card.id === "run" ? spine : null}
          trend={trend}
        />
      ))}
    </View>
  );
}

/**
 * One card: the app's glass surface, a header that is always readable, and a
 * body that grows under it.
 *
 * The body is mounted with the press and unmounted with the close, and the
 * card's height is animated by `Animated.View`'s own `layout` transition
 * rather than by a measured height — which is what lets it work for content
 * nobody can measure in advance, since a panel's blocks stream in one at a
 * time as their detail arrives. Unmounting costs nothing on reopen:
 * `Panel` seeds itself synchronously from the session's panel cache, so a
 * card opened twice shows its detail on the first frame both times.
 *
 * Suppressed outright rather than shortened when the reader has asked for
 * less motion: a card unfolding under the thumb is exactly the effect that
 * setting exists to turn off.
 */
function CardView({
  card,
  open,
  onToggle,
  spine,
  trend,
}: {
  card: BearingCard;
  open: boolean;
  onToggle: () => void;
  spine: SpineState | null;
  trend: number[];
}) {
  const t = useT();
  const reduceMotion = useReducedMotion();

  // The lead is the card's own figure and stays in the header whether the
  // card is open or shut: `Panel` is built on "the figure is already on
  // screen and already correct, so nothing here may cover it", and a headline
  // that jumped out of the header on the press would break exactly that.
  const rest = card.lead ? card.figures.slice(1) : card.figures;

  return (
    <Card className="mb-3">
      <Animated.View
        layout={
          reduceMotion
            ? undefined
            : LinearTransition.duration(DURATION.panel).easing(
                Easing.bezier(...EASE_STANDARD),
              )
        }
      >
        <Pressable
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          // The card's name and its figure as well as what pressing does: a
          // screen reader landing on one of five otherwise-similar headers
          // needs to hear which family it is pressing, and what pressing it
          // does depends on whether it is already open.
          accessibilityLabel={[
            t(card.nameKey),
            card.lead ? `${card.lead.label}: ${card.lead.display}` : null,
            t(open ? "bearing.panel.close" : "bearing.panel.open"),
          ]
            .filter(Boolean)
            .join(". ")}
          className="flex-row items-center gap-3"
        >
          <View className="min-w-0 flex-1 gap-0.5">
            <Text className="text-base font-medium">{t(card.nameKey)}</Text>
            {/* The caveat rides on the datum, so it is drawn beside the
                figure it qualifies rather than hidden — a figure presented as
                somebody's worth, in an app that records no debts, is wrong by
                exactly their mortgage. */}
            {card.lead?.note ? (
              <Text variant="micro" className="text-muted-foreground">
                {card.lead.note}
              </Text>
            ) : null}
          </View>

          {card.lead ? (
            <View className="shrink items-end gap-0.5">
              {/* Label above, figure below: a figure read before its label is
                  a number the eye has to hold while it finds out what it
                  was. */}
              <Text variant="micro" className="text-muted-foreground">
                {card.lead.label}
              </Text>
              <View className="flex-row items-end gap-2">
                <Run figure={card.lead} trend={trend} className="mb-1" />
                <LeadAmount figure={card.lead} />
              </View>
            </View>
          ) : null}

          <Caret open={open} />
        </Pressable>

        {open ? (
          <>
            {/* The ring, and deliberately not the flame. `Spine` still draws
                one when it is handed one; this card is handed `null` because
                `streak` and `best-streak` are figures in the pack and are
                already listed below as rows, in the same form every other
                figure on this surface takes. A badge saying the same two
                numbers a third time — the panel's own streak line says them
                twice — is the kind of repetition that makes a reader stop
                trusting that two statements of one figure are the same
                figure. */}
            {spine ? (
              <View className="mt-3 border-t border-border pt-3">
                <Spine state={{ ...spine, flame: null }} />
              </View>
            ) : null}

            {rest.length > 0 ? (
              <View className="mt-3">
                {rest.map((figure) => (
                  <FigureRow key={figure.id} figure={figure} trend={trend} />
                ))}
              </View>
            ) : null}

            <Panel card={card} />
          </>
        ) : null}
      </Animated.View>
    </Card>
  );
}

/**
 * One figure, and where it is explained — when it is explained anywhere.
 *
 * A row is pressable only when its own figure carries a destination this app
 * has a screen for. Four figures across the pack carry no href at all, and
 * `bearing-tiles.ts` is explicit about why that must stay visible: "a tile
 * with nowhere honest to lead leads nowhere; inventing a destination would
 * teach people that pressing tiles is a coin flip". Two more carry a web path
 * the phone has no answer to, which `phoneHref` turns into the same honest
 * nothing. Either way the row is drawn as what it is — a label and a number,
 * with no chevron and nothing to press.
 */
function FigureRow({ figure, trend }: { figure: CardFigure; trend: number[] }) {
  const router = useRouter();
  const colors = useThemeColors();
  const href = phoneHref(figure.href);

  const body = (
    <>
      <Text variant="muted" numberOfLines={2} className="min-w-0 flex-1">
        {figure.label}
      </Text>
      <Run figure={figure} trend={trend} />
      <PrivateAmount
        className="text-base font-semibold"
        style={{ color: toneFor(figure, colors) }}
      >
        {figure.display}
      </PrivateAmount>
      {/* Kept as an empty slot on a row that leads nowhere, rather than
          dropped: the chevron is what says this row can be pressed, and a
          column of figures that shifted sideways depending on whether the row
          above it had a destination would be harder to read than the
          affordance is worth. */}
      <View className="w-3 shrink-0 items-end">
        {href ? (
          <Ionicons
            name="chevron-forward"
            size={ICON.xs}
            color={colors.mutedForeground}
          />
        ) : null}
      </View>
    </>
  );

  // The same box either way, so the hairlines between rows line up whether or
  // not the row above one leads anywhere.
  const shape = "flex-row items-center gap-3 border-t border-border py-2.5";

  if (!href) {
    return <View className={shape}>{body}</View>;
  }

  return (
    <Pressable
      onPress={() => router.push(href as Href)}
      accessibilityRole="link"
      accessibilityLabel={`${figure.label}: ${figure.display}`}
      className={shape}
    >
      {body}
    </Pressable>
  );
}

/** The lead figure, at the one size a card's own number is drawn in. */
function LeadAmount({ figure }: { figure: CardFigure }) {
  const colors = useThemeColors();

  return (
    <PrivateAmount
      numberOfLines={1}
      adjustsFontSizeToFit
      style={[TYPE.figure, { color: toneFor(figure, colors) }]}
    >
      {figure.display}
    </PrivateAmount>
  );
}

/** The shape of the run, for the figures that draw one behind themselves. */
function Run({
  figure,
  trend,
  className,
}: {
  figure: CardFigure;
  trend: number[];
  className?: string;
}) {
  if (figure.series !== "trend" || trend.length < 2) {
    return null;
  }
  return (
    <View className={cn("shrink-0 opacity-70", className)}>
      <Sparkline values={trend} />
    </View>
  );
}

/** Which way the card is folded, on the app's one curve. */
function Caret({ open }: { open: boolean }) {
  const colors = useThemeColors();
  const reduceMotion = useReducedMotion();
  const turn = useSharedValue(open ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      turn.value = open ? 1 : 0;
      return;
    }
    turn.value = withTiming(open ? 1 : 0, {
      duration: DURATION.panel,
      easing: Easing.bezier(...EASE_STANDARD),
    });
  }, [open, reduceMotion, turn]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turn.value * 180}deg` }],
    opacity: 0.35 + turn.value * 0.35,
  }));

  return (
    <Animated.View style={style} className="shrink-0">
      <Ionicons
        name="chevron-down"
        size={ICON.md}
        color={colors.mutedForeground}
      />
    </Animated.View>
  );
}

/** The colour a figure takes from which way it has gone. */
function toneFor(
  figure: CardFigure,
  colors: ReturnType<typeof useThemeColors>,
): string {
  if (figure.sense === "neutral" || figure.value === 0) {
    return colors.foreground;
  }
  // The datum says which way is good; the value says which way it went. A
  // rise in something marked "rising is bad" is the one combination worth
  // colouring, and its opposite is the one worth rewarding.
  const good =
    figure.sense === "up-is-good" ? figure.value > 0 : figure.value < 0;
  return good ? colors.primaryInk : colors.destructive;
}
