import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AccessibilityInfo, Platform, Pressable, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";
import { resolveMessage } from "@finance/core/i18n/t";
import { useT } from "@/providers/LocaleProvider";

type ToastVariant = "default" | "success" | "error";

/** A button on the toast — Undo, mostly. Without a label there is none. */
export interface ToastAction {
  actionLabel: string;
  onAction: () => void;
}

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
  action?: ToastAction;
}

interface ToastContextValue {
  toast: (
    message: string,
    variant?: ToastVariant,
    action?: ToastAction,
  ) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VISIBLE_MS = 3500;

/**
 * Longer when there is something to press: an Undo the reader cannot reach
 * in time reports that the thing was reversible and then takes it away.
 */
const ACTIONABLE_MS = 8000;

const SURFACE: Record<ToastVariant, string> = {
  default: "bg-card",
  // The web's success: the neutral fill with a green edge, not a gold slab.
  success: "bg-secondary border border-success/40",
  error: "bg-destructive",
};

const LABEL: Record<ToastVariant, string> = {
  default: "text-foreground",
  success: "text-foreground",
  error: "text-destructive-foreground",
};

/**
 * Same API as the web ToastProvider — toast(message, variant) — so both
 * clients report the same way. Replaces the stock Android dialogs, which
 * blocked the UI for what is almost always a non-blocking result.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const insets = useSafeAreaInsets();
  const nextId = useRef(0);

  const t = useT();

  const toast = useCallback(
    (
      rawMessage: string,
      variant: ToastVariant = "default",
      action?: ToastAction,
    ) => {
      const id = nextId.current++;
      // Resolved here, and here only.
      //
      // Every transient message in the app passes through this function, which
      // makes it the one place a message key can become a sentence. The Zod
      // schemas in `packages/core/src/validations` emit keys because they are
      // built before any request has a language; a caller that already
      // translated its own string is unaffected, because `resolveMessage`
      // hands back anything it has no message for. See its comment for why
      // that is by design rather than by luck.
      const message = resolveMessage(t, rawMessage);
      setToasts((prev) => [...prev, { id, message, variant, action }]);
      // Android speaks the live region on the toast itself; iOS has no
      // equivalent, so it is announced explicitly there. Doing both on one
      // platform would say the message twice.
      if (Platform.OS === "ios") {
        AccessibilityInfo.announceForAccessibility(message);
      }
      setTimeout(
        () => {
          setToasts((prev) => prev.filter((entry) => entry.id !== id));
        },
        action ? ACTIONABLE_MS : VISIBLE_MS,
      );
    },
    [t],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View
        // Touches pass through to the screen, except on a toast's button.
        pointerEvents="box-none"
        className="absolute inset-x-0 top-0 items-center gap-2 px-4"
        style={{ paddingTop: insets.top + 12 }}
      >
        {toasts.map((entry) => (
          <Animated.View
            key={entry.id}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            entering={FadeInUp.duration(220)}
            exiting={FadeOutUp.duration(180)}
            pointerEvents={entry.action ? "box-none" : "none"}
            className={cn(
              "w-full max-w-sm flex-row items-center gap-3 rounded-card border border-border px-4 py-3",
              SURFACE[entry.variant],
            )}
          >
            <Text
              className={cn("flex-1 text-sm font-medium", LABEL[entry.variant])}
            >
              {entry.message}
            </Text>
            {entry.action ? (
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => {
                  setToasts((prev) =>
                    prev.filter((shown) => shown.id !== entry.id),
                  );
                  entry.action?.onAction();
                }}
                className="min-h-9 justify-center rounded-full px-3"
              >
                <Text
                  className={cn("text-sm font-semibold", LABEL[entry.variant])}
                >
                  {entry.action.actionLabel}
                </Text>
              </Pressable>
            ) : null}
          </Animated.View>
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
