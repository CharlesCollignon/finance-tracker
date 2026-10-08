import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInDown,
  FadeOutUp,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  ZoomIn,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import Svg, { Circle } from "react-native-svg";

import {
  formatEuro,
  formatPercentLabel,
  formatSignedPercentOf,
  todayIsoLocal,
} from "@finance/core/constants";
import { monthShort } from "@finance/core/i18n/calendar-names";
import { EASE_STANDARD } from "@finance/core/motion";
import { reviewedYear, type YearReview } from "@finance/core/year-review";

import { AnimatedAmount } from "@/components/AnimatedAmount";
import { PrivateAmount } from "@/components/PrivateAmount";
import { ScreenError } from "@/components/ScreenError";
import { Blur } from "@/components/ui/Blur";
import { Button } from "@/components/ui/Button";
import { ScreenSkeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { useRefreshable } from "@/hooks/useRefreshable";
import { WEB_APP_URL } from "@/lib/env";
import { hapticLight } from "@/lib/haptics";
import { getYearReview } from "@/lib/queries";
import { supabase } from "@/lib/supabase";
import { shareYearImage } from "@/lib/year-review-share";
import { useAuth } from "@/providers/AuthProvider";
import { useFormatCurrency } from "@/providers/CurrencyProvider";
import { useLocale, useT } from "@/providers/LocaleProvider";
import { useToast } from "@/providers/ToastProvider";
import { COLORS, ICON } from "@/theme/tokens";

/** How long a slide stays before the next one, when nothing holds it. */
const SLIDE_MS = 6500;
const EASING = Easing.bezier(...EASE_STANDARD);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type SlideId =
  | "intro"
  | "kept"
  | "closes"
  | "category"
  | "milestones"
  | "share";

/**
 * « Votre année », told as a story, as on the web: one slide a screen, bars
 * across the top filling as each one plays, a tap on the right for the next
 * and on the left for the one before, a swipe, a hold to pause. The figures
 * count up, the ring fills, the months light one after the other, the bars
 * grow, the milestones spring in — and the last slide is the image to share
 * (no amount in it), through the phone's own share sheet. A light haptic on
 * each page turned.
 *
 * Under reduced motion every slide lands on its final state and nothing
 * plays by itself.
 */
export default function YearScreen() {
  const t = useT();
  const locale = useLocale();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ y?: string }>();
  const today = todayIsoLocal();
  const current = Number(today.slice(0, 4));
  const asked = Number(params.y);
  const year =
    Number.isInteger(asked) && asked >= 2000 && asked < current
      ? asked
      : (reviewedYear(today) ?? current - 1);

  const { data, error, loading, onRefresh } = useRefreshable(
    async () => (user ? await getYearReview(user.id, year, locale) : null),
    [user?.id, year, locale],
    { reads: ["transactions", "closes", "preferences"] },
  );

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <StatusBar style="light" />
      {error ? (
        <View className="flex-1 justify-center px-4">
          <ScreenError message={error} onRetry={onRefresh} />
        </View>
      ) : loading ? (
        <View className="flex-1 justify-center px-4">
          <ScreenSkeleton rows={3} />
        </View>
      ) : data === null ? (
        <View className="flex-1 justify-center px-6">
          <Text variant="muted" className="text-base">
            {t("yearReview.nothing", { year })}
          </Text>
        </View>
      ) : (
        <Story year={year} review={data} />
      )}
    </View>
  );
}

function Story({ year, review }: { year: number; review: YearReview }) {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduce = useReducedMotion();

  const slides: SlideId[] = [
    "intro",
    ...(review.kept ? (["kept"] as const) : []),
    ...(review.closes.count > 0 ? (["closes"] as const) : []),
    ...(review.category ? (["category"] as const) : []),
    ...(review.milestones.length > 0 ? (["milestones"] as const) : []),
    "share",
  ];
  const last = slides.length - 1;
  const [index, setIndex] = useState(0);
  // Bumped on each visit, so a slide's figures count up again.
  const [visit, setVisit] = useState(0);
  const [held, setHeld] = useState(false);
  const [paused, setPaused] = useState(false);
  const playing = !paused && !reduce;
  const progress = useSharedValue(0);
  const slide = slides[index]!;

  const goTo = useCallback(
    (next: number, byHand = true) => {
      const clamped = Math.max(0, Math.min(last, next));
      if (byHand) {
        void hapticLight();
      }
      cancelAnimation(progress);
      progress.set(0);
      setIndex(clamped);
      setVisit((count) => count + 1);
    },
    [last, progress],
  );

  const close = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  }, [router]);

  // The bar of the slide on screen fills while nothing holds it; full, the
  // story turns the page. The last slide waits for the reader.
  useEffect(() => {
    if (!playing || held || index === last) {
      cancelAnimation(progress);
      return;
    }
    const advance = () => goTo(index + 1, false);
    progress.set(
      withTiming(
      1,
      {
        duration: SLIDE_MS * (1 - progress.get()),
        easing: Easing.linear,
      },
      (finished) => {
        if (finished) {
          scheduleOnRN(advance);
        }
      },
      ),
    );
    return () => cancelAnimation(progress);
  }, [index, playing, held, last, goTo, progress]);

  const onTap = useCallback(
    (x: number) => goTo(index + (x < width * 0.3 ? -1 : 1)),
    [goTo, index, width],
  );
  const onSwipe = useCallback(
    (dx: number) => goTo(index + (dx < 0 ? 1 : -1)),
    [goTo, index],
  );

  const gesture = Gesture.Race(
    Gesture.Pan()
      .activeOffsetX([-25, 25])
      .onEnd((event) => {
        scheduleOnRN(onSwipe, event.translationX);
      }),
    Gesture.LongPress()
      .minDuration(250)
      .onStart(() => {
        scheduleOnRN(setHeld, true);
      })
      .onFinalize(() => {
        scheduleOnRN(setHeld, false);
      }),
    Gesture.Tap()
      .maxDuration(250)
      .onEnd((event, success) => {
        if (success) {
          scheduleOnRN(onTap, event.x);
        }
      }),
  );

  return (
    <View style={{ flex: 1, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }}>
      <Backdrop slide={index} />

      <View className="flex-row gap-1.5 px-4">
        {slides.map((id, position) => (
          <StoryBar
            key={id}
            state={position < index ? "done" : position === index ? "now" : "ahead"}
            progress={progress}
            full={position === last}
          />
        ))}
      </View>

      <View className="flex-row items-center justify-between px-4 pt-3">
        <Text variant="muted" className="text-sm font-medium">
          {t("yearReview.title", { year })}
        </Text>
        <View className="flex-row items-center gap-1">
          {index < last && !reduce ? (
            <RoundButton
              icon={playing ? "pause" : "play"}
              label={playing ? t("yearReview.pause") : t("yearReview.play")}
              onPress={() => setPaused((value) => !value)}
            />
          ) : null}
          <RoundButton icon="close" label={t("yearReview.close")} onPress={close} />
        </View>
      </View>

      <GestureDetector gesture={gesture}>
        <View className="flex-1 justify-center px-6" collapsable={false}>
          <Animated.View
            key={`${slide}:${visit}`}
            entering={FadeInDown.duration(450).easing(EASING)}
            exiting={FadeOutUp.duration(220)}
            className="gap-6"
            accessibilityLiveRegion="polite"
          >
            {slide === "intro" ? <IntroSlide year={year} /> : null}
            {slide === "kept" ? <KeptSlide review={review} /> : null}
            {slide === "closes" ? <ClosesSlide review={review} /> : null}
            {slide === "category" ? <CategorySlide review={review} /> : null}
            {slide === "milestones" ? <MilestonesSlide review={review} /> : null}
            {slide === "share" ? (
              <ShareSlide year={year} onReplay={() => goTo(0)} />
            ) : null}
          </Animated.View>
        </View>
      </GestureDetector>

      <View className="flex-row items-center justify-between px-4">
        <RoundButton
          icon="chevron-back"
          label={t("yearReview.previous")}
          onPress={() => goTo(index - 1)}
          disabled={index === 0}
        />
        <Text variant="muted" className="text-xs">
          {t("yearReview.slideOf", { step: index + 1, total: slides.length })}
        </Text>
        <RoundButton
          icon="chevron-forward"
          label={t("yearReview.next")}
          onPress={() => goTo(index + 1)}
          disabled={index === last}
        />
      </View>
    </View>
  );
}

/** One slide's bar: filled behind, filling now, empty ahead. */
function StoryBar({
  state,
  progress,
  full,
}: {
  state: "done" | "now" | "ahead";
  progress: SharedValue<number>;
  /** The last slide's, which waits for the reader and so shows full. */
  full: boolean;
}) {
  const filling = useAnimatedStyle(() => ({
    transform: [{ scaleX: full ? 1 : progress.get() }],
  }));
  return (
    <View
      className="h-1 flex-1 overflow-hidden rounded-full"
      style={{ backgroundColor: "rgba(245,243,239,0.15)" }}
    >
      {state === "done" ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(245,243,239,0.8)" }]} />
      ) : state === "now" ? (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "rgba(245,243,239,0.8)", transformOrigin: "left" },
            filling,
          ]}
        />
      ) : null}
    </View>
  );
}

function RoundButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: "pause" | "play" | "close" | "chevron-back" | "chevron-forward";
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      disabled={disabled}
      onPress={onPress}
      className="h-10 w-10 items-center justify-center rounded-full"
      style={disabled ? { opacity: 0.3 } : undefined}
    >
      <Ionicons name={icon} size={ICON.lg} color={COLORS.foreground} />
    </Pressable>
  );
}

/** Two lights behind the slides, gold and violet, moving with each slide. */
function Backdrop({ slide }: { slide: number }) {
  const { width, height } = useWindowDimensions();
  const spots = [
    [-0.2, -0.05],
    [0.3, 0.1],
    [-0.25, 0.4],
    [0.2, 0.55],
    [0, 0.2],
    [0.3, -0.1],
  ] as const;
  const gold = spots[slide % spots.length]!;
  const violet = spots[(slide + 3) % spots.length]!;
  const goldStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: withTiming(gold[0] * width, { duration: 2400, easing: EASING }) },
      { translateY: withTiming(gold[1] * height, { duration: 2400, easing: EASING }) },
    ],
  }));
  const violetStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: withTiming(violet[0] * width, { duration: 2800, easing: EASING }) },
      { translateY: withTiming(violet[1] * height, { duration: 2800, easing: EASING }) },
    ],
  }));
  const size = Math.max(width, height) * 0.7;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          {
            position: "absolute",
            left: width * 0.15,
            top: height * 0.15,
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: "rgba(236,178,94,0.22)",
          },
          goldStyle,
        ]}
      />
      <Animated.View
        style={[
          {
            position: "absolute",
            left: width * 0.25,
            top: height * 0.3,
            width: size * 0.9,
            height: size * 0.9,
            borderRadius: size,
            backgroundColor: "rgba(124,92,255,0.18)",
          },
          violetStyle,
        ]}
      />
      <Blur amount={80} style={StyleSheet.absoluteFill} overlayColor="rgba(10,10,16,0.35)" />
    </View>
  );
}

/** A part of a slide, arriving after the one before. */
function Rise({ order, children }: { order: number; children: ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.delay(150 + order * 120).duration(450).easing(EASING)}>
      {children}
    </Animated.View>
  );
}

function SlideTitle({ children }: { children: string }) {
  return (
    <Rise order={0}>
      <Text variant="muted" className="text-sm font-semibold uppercase tracking-widest">
        {children}
      </Text>
    </Rise>
  );
}

/** A slide's big figure: the card figure's face, at story size, in gold. */
const HERO = {
  fontFamily: "Fraunces-SemiBold",
  fontSize: 64,
  lineHeight: 72,
  color: COLORS.primary,
};

function IntroSlide({ year }: { year: number }) {
  const t = useT();
  return (
    <>
      <Rise order={0}>
        <Text variant="muted" className="text-lg">
          {t("nav.yearReview")}
        </Text>
      </Rise>
      <View className="flex-row">
        {String(year)
          .split("")
          .map((digit, position) => (
            <Animated.Text
              key={position}
              entering={FadeInDown.delay(200 + position * 90).springify().damping(14)}
              style={{ fontSize: 112, lineHeight: 124, color: COLORS.primary, fontFamily: "Fraunces-SemiBold" }}
            >
              {digit}
            </Animated.Text>
          ))}
      </View>
      <Rise order={4}>
        <Text className="text-lg">{t("yearReview.lead")}</Text>
      </Rise>
      <Animated.View entering={FadeIn.delay(1200).duration(600)}>
        <Text variant="muted" className="text-sm">
          {t("yearReview.tapToStart")}
        </Text>
      </Animated.View>
    </>
  );
}

function KeptSlide({ review }: { review: YearReview }) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const kept = review.kept!;
  const rate = kept.rate === null ? null : Math.max(0, Math.min(1, kept.rate));
  return (
    <>
      <SlideTitle>{t("yearReview.keptTitle")}</SlideTitle>
      <Rise order={1}>
        <AnimatedAmount
          value={kept.amount}
          startFrom={0}
          format={format}
          style={HERO}
          numberOfLines={1}
          adjustsFontSizeToFit
        />
        <Text className="mt-1 text-lg">
          {t("yearReview.keptCaption", { year: review.year })}
        </Text>
      </Rise>
      {rate !== null ? (
        <Rise order={2}>
          <Ring
            value={rate}
            label={formatPercentLabel(Math.round(rate * 100), locale)}
            caption={t("yearReview.rateOfIncome")}
          />
        </Rise>
      ) : null}
      <Rise order={3}>
        <Text variant="muted" className="text-sm">
          {t(
            kept.source === "closes"
              ? "yearReview.keptFromCloses"
              : "yearReview.keptFromRecorded",
          )}
        </Text>
      </Rise>
    </>
  );
}

/** A ring that fills to a share, its figure in the middle. */
function Ring({
  value,
  label,
  caption,
}: {
  value: number;
  label: string;
  caption: string;
}) {
  const size = 140;
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = useSharedValue(0);
  useEffect(() => {
    filled.set(withDelay(500, withTiming(value, { duration: 1400, easing: EASING })));
  }, [filled, value]);
  const props = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - filled.get()),
  }));
  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(245,243,239,0.1)"
          strokeWidth={stroke}
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={COLORS.primary}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={props}
        />
      </Svg>
      <Text style={{ fontSize: 24 }}>{label}</Text>
      <Text variant="muted" className="text-center text-[11px]" style={{ maxWidth: 96 }}>
        {caption}
      </Text>
    </View>
  );
}

function ClosesSlide({ review }: { review: YearReview }) {
  const t = useT();
  const locale = useLocale();
  return (
    <>
      <SlideTitle>{t("yearReview.closesTitle")}</SlideTitle>
      <Rise order={1}>
        <AnimatedAmount
          value={review.closes.count}
          startFrom={0}
          format={(value) => String(Math.round(value))}
          style={HERO}
        />
        <Text className="mt-1 text-lg">
          {t("yearReview.closesCaption", { count: review.closes.count })}
        </Text>
      </Rise>
      {/* The twelve months, lit one after the other: closed, won, and the
          longest run of them in gold. */}
      <View className="flex-row flex-wrap" style={{ rowGap: 12 }}>
        {review.months.map((month, position) => (
          <View key={month.monthKey} className="items-center gap-1.5" style={{ width: "16.66%" }}>
            <Animated.View
              entering={ZoomIn.delay(450 + position * 70).springify().damping(13)}
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: month.inBestRun || month.won
                  ? COLORS.primary
                  : month.closed
                    ? "rgba(245,243,239,0.4)"
                    : "rgba(245,243,239,0.2)",
                backgroundColor: month.inBestRun
                  ? COLORS.primary
                  : month.won
                    ? "rgba(236,178,94,0.4)"
                    : month.closed
                      ? "rgba(245,243,239,0.25)"
                      : "transparent",
              }}
            />
            <Text variant="muted" className="text-[11px]">
              {monthShort(Number(month.monthKey.slice(5, 7)), locale)}
            </Text>
          </View>
        ))}
      </View>
      {review.closes.bestRun > 0 ? (
        <Rise order={6}>
          <Text className="text-base">
            {t("yearReview.bestRun", { count: review.closes.bestRun })}
          </Text>
        </Rise>
      ) : null}
    </>
  );
}

function CategorySlide({ review }: { review: YearReview }) {
  const t = useT();
  const locale = useLocale();
  const format = useFormatCurrency();
  const category = review.category!;

  if (category.kind === "share") {
    return (
      <>
        <SlideTitle>{t("yearReview.categoryTitle")}</SlideTitle>
        <Rise order={1}>
          <Text style={HERO}>
            {formatPercentLabel(Math.round(category.share * 100), locale)}
          </Text>
          <Text className="mt-1 text-lg">
            {t("yearReview.categoryShareCaption", { name: category.name })}
          </Text>
        </Rise>
        <Bar label={category.name} amount={format(category.amount)} ratio={category.share} gold order={2} />
      </>
    );
  }

  const widest = Math.max(category.before, category.after);
  return (
    <>
      <SlideTitle>{t("yearReview.categoryTitle")}</SlideTitle>
      <Rise order={1}>
        <Text style={{ fontSize: 34 }}>{category.name}</Text>
      </Rise>
      <View className="gap-3">
        <Bar
          label={String(review.year - 1)}
          amount={format(category.before)}
          ratio={category.before / widest}
          order={2}
        />
        <Bar
          label={String(review.year)}
          amount={format(category.after)}
          ratio={category.after / widest}
          gold
          order={3}
        />
      </View>
      <Animated.View
        entering={ZoomIn.delay(1300).springify().damping(11)}
        className="self-start rounded-full px-4 py-1.5"
        style={{
          backgroundColor:
            category.change < 0 ? "rgba(52,211,153,0.15)" : "rgba(236,178,94,0.15)",
        }}
      >
        <Text
          style={{
            fontSize: 24,
            color: category.change < 0 ? COLORS.success : COLORS.primary,
          }}
        >
          {formatSignedPercentOf(category.change, locale, 0)}
        </Text>
      </Animated.View>
    </>
  );
}

/** One year's bar, growing to its length. */
function Bar({
  label,
  amount,
  ratio,
  gold = false,
  order,
}: {
  label: string;
  amount: string;
  ratio: number;
  gold?: boolean;
  order: number;
}) {
  const grown = useSharedValue(0);
  useEffect(() => {
    grown.set(
      withDelay(
        400 + order * 150,
        withTiming(Math.max(0.02, ratio), { duration: 1100, easing: EASING }),
      ),
    );
  }, [grown, ratio, order]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleX: grown.get() }] }));
  return (
    <Rise order={order}>
      <View className="gap-1.5">
        <View className="flex-row items-baseline justify-between gap-3">
          <Text variant="muted" className="text-sm">
            {label}
          </Text>
          <PrivateAmount className="text-sm">{amount}</PrivateAmount>
        </View>
        <View className="h-4 overflow-hidden rounded-full" style={{ backgroundColor: "rgba(245,243,239,0.1)" }}>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                borderRadius: 999,
                transformOrigin: "left",
                backgroundColor: gold ? COLORS.primary : "rgba(245,243,239,0.45)",
              },
              style,
            ]}
          />
        </View>
      </View>
    </Rise>
  );
}

function MilestonesSlide({ review }: { review: YearReview }) {
  const t = useT();
  const locale = useLocale();
  return (
    <>
      <SlideTitle>{t("yearReview.milestonesTitle")}</SlideTitle>
      <View className="flex-row flex-wrap gap-3">
        {review.milestones.map((amount, position) => (
          <Animated.View
            key={amount}
            entering={ZoomIn.delay(300 + position * 180).springify().damping(12)}
            className="rounded-card px-6 py-5"
            style={{
              borderWidth: 1,
              borderColor: "rgba(236,178,94,0.6)",
              backgroundColor: "rgba(236,178,94,0.1)",
            }}
          >
            <PrivateAmount style={{ fontSize: 28, color: COLORS.primary }}>
              {formatEuro(amount, locale)}
            </PrivateAmount>
          </Animated.View>
        ))}
      </View>
      <Rise order={3}>
        <Text className="text-lg">
          {t("yearReview.milestonesCaption", { count: review.milestones.length })}
        </Text>
      </Rise>
    </>
  );
}

/** The image to share, the share sheet, and the way back in. */
function ShareSlide({ year, onReplay }: { year: number; onReplay: () => void }) {
  const t = useT();
  const locale = useLocale();
  const { toast } = useToast();
  const [sharing, setSharing] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  // The image is drawn for the account in the token, as the share sheet's is.
  useEffect(() => {
    let current = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (current) {
        setToken(data.session?.access_token ?? null);
      }
    });
    return () => {
      current = false;
    };
  }, []);

  async function share() {
    setSharing(true);
    void hapticLight();
    const outcome = await shareYearImage(year, locale, t("yearReview.imageTitle", { year }));
    setSharing(false);
    if (outcome === "failed") {
      toast(t("bankConnect.unreachable"), "error");
    }
  }

  return (
    <View className="items-center gap-5">
      <SlideTitle>{t("yearReview.shareTitle")}</SlideTitle>
      {WEB_APP_URL && token ? (
        <Animated.View entering={FadeInDown.delay(250).springify().damping(16)}>
          <Image
            source={{
              uri: `${WEB_APP_URL}/api/year-review/image?y=${year}&l=${locale}`,
              headers: { Authorization: `Bearer ${token}` },
            }}
            accessibilityLabel={t("yearReview.imageTitle", { year })}
            style={{ width: 200, height: 250, borderRadius: 20 }}
          />
        </Animated.View>
      ) : null}
      <Rise order={3}>
        <Text variant="muted" className="text-center text-xs" style={{ maxWidth: 260 }}>
          {t("yearReview.shareHint")}
        </Text>
      </Rise>
      <Rise order={4}>
        <View className="items-center gap-2">
          <Button
            label={t("yearReview.share")}
            icon="share-outline"
            size="lg"
            disabled={sharing}
            onPress={() => void share()}
          />
          <Button label={t("yearReview.replay")} icon="refresh" variant="ghost" onPress={onReplay} />
        </View>
      </Rise>
    </View>
  );
}
