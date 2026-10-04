import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { QuickAddSheet, type AddKind } from "@/components/QuickAddSheet";
import { useRefreshable } from "@/hooks/useRefreshable";
import { hapticMedium } from "@/lib/haptics";
import { getQuickEntryContext, type QuickEntryContext } from "@/lib/queries";
import { useAuth } from "@/providers/AuthProvider";
import { Blur } from "@/components/ui/Blur";
import { useTabBarHeight } from "@/theme/chrome";
import { useThemeColors } from "@/theme/useThemeColors";
import { ICON, RADIUS } from "@/theme/tokens";
import { useT } from "@/providers/LocaleProvider";
import { DURATION } from "@finance/core/motion";
import type { CategoryType } from "@finance/core/types/database";

const EMPTY: QuickEntryContext = {
  categories: [],
  recentCategoryIds: [],
  merchants: [],
};

interface OpenOptions {
  /** A date to start on — the calendar opens the sheet on the day in view. */
  date?: string;
  /** Which kind to start on. A transaction unless the caller says otherwise. */
  kind?: AddKind;
  /**
   * For a charge, the kind of money its category picker opens on — a kind's
   * « + » on Récurrents opens on that kind's.
   */
  categoryType?: CategoryType;
}

interface QuickAddValue {
  /** Opens the sheet; the reader can still switch kind inside it. */
  open: (options?: OpenOptions) => void;
  isOpen: boolean;
}

const QuickAddContext = createContext<QuickAddValue | null>(null);

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Adding a transaction or a charge from anywhere in the tab stack.
 *
 * Sits above the tabs rather than inside them: the bar already carries six
 * destinations, and the app's primary action should not have to compete with
 * them for a slot — nor should logging a coffee start with choosing a tab.
 * Every Add in the app opens this one sheet, so there is a single way in
 * whichever button was pressed.
 */
export function QuickAddProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [date, setDate] = useState<string | undefined>(undefined);
  const [kind, setKind] = useState<AddKind>("transaction");
  const [categoryType, setCategoryType] = useState<CategoryType | undefined>(
    undefined,
  );
  // Bumped on every open so the sheet's fields remount with clean state.
  const [openToken, setOpenToken] = useState(0);

  // The categories to pick from, and the recent rows the suggestions are
  // learned from: a category created in Profile is in the picker the next
  // time the sheet opens.
  const { data } = useRefreshable(
    async () => {
      if (!user) {
        return EMPTY;
      }
      return getQuickEntryContext(user.id);
    },
    [user?.id],
    { reads: ["categories", "transactions"] },
  );

  const open = useCallback((options?: OpenOptions) => {
    setDate(options?.date);
    setKind(options?.kind ?? "transaction");
    setCategoryType(options?.categoryType);
    setOpenToken((token) => token + 1);
    setIsOpen(true);
  }, []);

  const value = useMemo<QuickAddValue>(
    () => ({ open, isOpen }),
    [open, isOpen],
  );
  const context = data ?? EMPTY;

  return (
    <QuickAddContext.Provider value={value}>
      {children}
      {user ? <QuickAddFab /> : null}
      <QuickAddSheet
        open={isOpen}
        onClose={() => setIsOpen(false)}
        categories={context.categories}
        recentCategoryIds={context.recentCategoryIds}
        merchants={context.merchants}
        defaultDate={date}
        kind={kind}
        categoryType={categoryType}
        openToken={openToken}
      />
    </QuickAddContext.Provider>
  );
}

/** Null outside the tab stack (auth, onboarding), so callers can no-op. */
export function useQuickAdd(): QuickAddValue | null {
  return useContext(QuickAddContext);
}

/** The add button's ground: the gold (`COLORS.primary`), at 72 %. */
const GOLD_GLASS = "rgba(236,178,94,0.72)";
/** A lighter edge, so the glass reads as a surface over the content. */
const GLASS_RIM = "rgba(255,240,210,0.35)";

function QuickAddFab() {
  const t = useT();
  const quickAdd = useQuickAdd();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  // Asked for rather than restated: the bar grows with the system text size,
  // and the copy of its height that used to live here did not, so the button
  // drifted into the bar at the larger accessibility sizes.
  const barHeight = useTabBarHeight();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  if (!quickAdd || quickAdd.isOpen) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        right: 16,
        // Above the tab bar, docked to the bottom edge.
        bottom: barHeight + insets.bottom + 16,
      }}
    >
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel={t("add.open")}
        onPressIn={() => {
          scale.set(withTiming(0.92, { duration: DURATION.press }));
        }}
        onPressOut={() => {
          scale.set(withTiming(1, { duration: DURATION.press }));
        }}
        onPress={() => {
          void hapticMedium();
          quickAdd.open();
        }}
        style={[
          {
            height: 56,
            width: 56,
            borderRadius: RADIUS.pill,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: GLASS_RIM,
          },
          animatedStyle,
        ]}
      >
        {/* Gold glass: still the one gold control on the screen, but what
            scrolls under it shows through, frosted, rather than being cut
            off by a solid disc. */}
        <Blur
          // Its own corners too: Android's blur clips to its own outline.
          style={[StyleSheet.absoluteFill, { borderRadius: RADIUS.pill }]}
          overlayColor={GOLD_GLASS}
        />
        <Ionicons
          name="add"
          size={ICON.hero}
          color={colors.primaryForeground}
        />
      </AnimatedPressable>
    </View>
  );
}
