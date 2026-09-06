import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { QuickAddSheet } from "@/components/QuickAddSheet";
import { useRefreshable } from "@/hooks/useRefreshable";
import { hapticMedium } from "@/lib/haptics";
import { notifyDataChanged, useDataVersion } from "@/lib/data-version";
import { getQuickEntryContext, type QuickEntryContext } from "@/lib/queries";
import { useAuth } from "@/providers/AuthProvider";
import { useTabBarHeight } from "@/theme/chrome";
import { useThemeColors } from "@/theme/useThemeColors";
import { ICON } from "@/theme/tokens";

const EMPTY: QuickEntryContext = {
  categories: [],
  tags: [],
  recentCategoryIds: [],
  merchants: [],
};

interface QuickAddValue {
  open: (date?: string) => void;
  isOpen: boolean;
}

const QuickAddContext = createContext<QuickAddValue | null>(null);

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Adding a transaction from anywhere in the tab stack.
 *
 * Sits above the tabs rather than inside them: the bar already carries six
 * destinations, and the app's primary action should not have to compete with
 * them for a slot — nor should logging a coffee start with choosing a tab.
 */
export function QuickAddProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const dataVersion = useDataVersion();
  const [isOpen, setIsOpen] = useState(false);
  const [date, setDate] = useState<string | undefined>(undefined);
  // Bumped on every open so the sheet's fields remount with clean state.
  const [openToken, setOpenToken] = useState(0);

  const { data, reload } = useRefreshable(async () => {
    if (!user) {
      return EMPTY;
    }
    return getQuickEntryContext(user.id);
  }, [user?.id, dataVersion]);

  const open = useCallback((nextDate?: string) => {
    setDate(nextDate);
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
        onSaved={() => {
          // Refresh every screen's figures, and the sheet's own recents.
          notifyDataChanged();
          void reload();
        }}
        categories={context.categories}
        tags={context.tags}
        recentCategoryIds={context.recentCategoryIds}
        merchants={context.merchants}
        defaultDate={date}
        openToken={openToken}
      />
    </QuickAddContext.Provider>
  );
}

/** Null outside the tab stack (auth, onboarding), so callers can no-op. */
export function useQuickAdd(): QuickAddValue | null {
  return useContext(QuickAddContext);
}

function QuickAddFab() {
  const quickAdd = useQuickAdd();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  // Asked for rather than restated: the bar grows with the system text size,
  // and the copy of its height that used to live here did not, so the button
  // drifted into the bar at the larger accessibility sizes.
  const barHeight = useTabBarHeight();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
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
        bottom: barHeight + insets.bottom + 16,
      }}
    >
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel="Add transaction"
        onPressIn={() => {
          scale.value = withTiming(0.92, { duration: 110 });
        }}
        onPressOut={() => {
          scale.value = withTiming(1, { duration: 140 });
        }}
        onPress={() => {
          void hapticMedium();
          quickAdd.open();
        }}
        style={[
          {
            height: 56,
            width: 56,
            borderRadius: 28,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.primary,
            shadowColor: "#000",
            shadowOpacity: 0.25,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 6,
          },
          animatedStyle,
        ]}
      >
        <Ionicons
          name="add"
          size={ICON.hero}
          color={colors.primaryForeground}
        />
      </AnimatedPressable>
    </View>
  );
}
