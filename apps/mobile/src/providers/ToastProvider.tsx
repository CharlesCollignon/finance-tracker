import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/Text";
import { cn } from "@/lib/cn";

type ToastVariant = "default" | "success" | "error";

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VISIBLE_MS = 3500;

const SURFACE: Record<ToastVariant, string> = {
  default: "bg-card",
  success: "bg-primary",
  error: "bg-destructive",
};

const LABEL: Record<ToastVariant, string> = {
  default: "text-foreground",
  success: "text-primary-foreground",
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

  const toast = useCallback(
    (message: string, variant: ToastVariant = "default") => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, message, variant }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((entry) => entry.id !== id));
      }, VISIBLE_MS);
    },
    [],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View
        pointerEvents="none"
        className="absolute inset-x-0 top-0 items-center gap-2 px-4"
        style={{ paddingTop: insets.top + 12 }}
      >
        {toasts.map((entry) => (
          <Animated.View
            key={entry.id}
            entering={FadeInUp.duration(220)}
            exiting={FadeOutUp.duration(180)}
            className={cn(
              "w-full max-w-sm rounded-xl border border-border px-4 py-3",
              SURFACE[entry.variant],
            )}
          >
            <Text className={cn("text-sm font-medium", LABEL[entry.variant])}>
              {entry.message}
            </Text>
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
