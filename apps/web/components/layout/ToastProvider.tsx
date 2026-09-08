"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { resolveMessage } from "@finance/core/i18n/t";
import { useT } from "@/lib/locale-context";

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

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const t = useT();

  const toast = useCallback(
    (message: string, variant: ToastVariant = "default") => {
      const id = Date.now();
      // Resolved here, and here only.
      //
      // Every transient message in the app passes through this function, which
      // makes it the one place a message key can become a sentence. The Zod
      // schemas in `packages/core/src/validations` emit keys because they are
      // built before any request has a language; a caller that already
      // translated its own string is unaffected, because `resolveMessage`
      // hands back anything it has no message for. See its comment for why
      // that is by design rather than by luck.
      setToasts((prev) => [
        ...prev,
        { id, message: resolveMessage(t, message), variant },
      ]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3500);
    },
    [t],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className={cn(
          "pointer-events-none fixed z-[100]",
          "inset-x-0 top-0 flex flex-col items-center gap-2",
          "p-4 pt-[calc(env(safe-area-inset-top,0px)+1rem)]",
          "md:inset-x-auto md:inset-y-auto md:bottom-6 md:right-6 md:top-auto",
          "md:items-end md:p-0",
        )}
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto w-full max-w-sm border border-border",
              "px-4 py-3 text-sm font-medium",
              t.variant === "success" && "bg-primary text-primary-foreground",
              t.variant === "error" &&
                "bg-destructive text-destructive-foreground",
              t.variant === "default" && "bg-background text-foreground",
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
