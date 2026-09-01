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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { QuickAddSheet } from "@/components/QuickAddSheet";
import { useRefreshable } from "@/hooks/useRefreshable";
import { hapticLight } from "@/lib/haptics";
import { notifyDataChanged, useDataVersion } from "@/lib/data-version";
import { getQuickEntryContext, type QuickEntryContext } from "@/lib/queries";
import { useAuth } from "@/providers/AuthProvider";
import { useThemeColors } from "@/theme/useThemeColors";

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

/** Height of the tab bar the button has to clear. Mirrors TabsLayout. */
const TAB_BAR_HEIGHT = 60;

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

  const { data, reload } = useRefreshable(async () => {
    if (!user) {
      return EMPTY;
    }
    return getQuickEntryContext(user.id);
  }, [user?.id, dataVersion]);

  const open = useCallback((nextDate?: string) => {
    setDate(nextDate);
    setIsOpen(true);
  }, []);

  const value = useMemo<QuickAddValue>(() => ({ open, isOpen }), [open, isOpen]);
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

  if (!quickAdd || quickAdd.isOpen) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        right: 16,
        bottom: TAB_BAR_HEIGHT + insets.bottom + 16,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add transaction"
        onPress={() => {
          void hapticLight();
          quickAdd.open();
        }}
        style={({ pressed }) => ({
          height: 56,
          width: 56,
          borderRadius: 28,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.primary,
          transform: [{ scale: pressed ? 0.94 : 1 }],
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        })}
      >
        <Ionicons name="add" size={28} color={colors.primaryForeground} />
      </Pressable>
    </View>
  );
}
