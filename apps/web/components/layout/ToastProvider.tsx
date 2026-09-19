"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { resolveMessage } from "@finance/core/i18n/t";
import { useT } from "@/lib/locale-context";
import { SwipeToast, type ToastVariant } from "@/components/layout/SwipeToast";

export type { ToastVariant };

/**
 * What a toast can say.
 *
 * The second line and the button are the additions. A toast that reports a
 * destructive thing having happened is the one moment the reader is looking
 * at the right place to be offered it back, and until now this provider had
 * nowhere to put that offer.
 */
export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** The button's words. Without them there is no button. */
  actionLabel?: string;
  onAction?: () => void;
  /** Milliseconds on screen. Zero keeps it until dismissed. */
  duration?: number;
}

interface Toast extends ToastOptions {
  id: number;
}

/**
 * Two shapes, one function.
 *
 * `toast(message, variant)` is how all ninety-five existing call sites speak
 * and it keeps working unchanged; the object form is for the ones that have
 * something more to say. An overload rather than a second exported function,
 * because two names would mean every call site having to be told which one it
 * wanted, and the answer for almost all of them is "the short one".
 */
export interface ToastContextValue {
  (message: string, variant?: ToastVariant): void;
  (options: ToastOptions): void;
}

const ToastContext = createContext<{ toast: ToastContextValue } | null>(null);

/** How long a toast with nothing to press stays. */
const DEFAULT_DURATION = 3500;

/**
 * Longer when there is something to press.
 *
 * An Undo the reader cannot reach in time is worse than no Undo: it reports
 * that the thing was reversible and then takes the reversal away. Hovering
 * the toast pauses this, so the real ceiling is how long it goes unnoticed.
 */
const ACTIONABLE_DURATION = 8000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const t = useT();

  // Date.now() collides when two toasts are raised in the same millisecond —
  // two failures from one submit, say — and duplicate React keys make the
  // second overwrite the first rather than stack beneath it.
  const nextId = useRef(0);

  const toast = useCallback(
    (first: string | ToastOptions, variant: ToastVariant = "default") => {
      const options: ToastOptions =
        typeof first === "string"
          ? { title: first, variant }
          : { variant: "default", ...first };

      const id = (nextId.current += 1);

      setToasts((previous) => [
        ...previous,
        {
          ...options,
          // Resolved here, and here only.
          //
          // Every transient message in the app passes through this function,
          // which makes it the one place a message key can become a sentence.
          // The Zod schemas in `packages/core/src/validations` emit keys
          // because they are built before any request has a language; a caller
          // that already translated its own string is unaffected, because
          // `resolveMessage` hands back anything it has no message for. See
          // its comment for why that is by design rather than by luck.
          title: resolveMessage(t, options.title),
          description:
            options.description === undefined
              ? undefined
              : resolveMessage(t, options.description),
          duration:
            options.duration ??
            (options.actionLabel ? ACTIONABLE_DURATION : DEFAULT_DURATION),
          id,
        },
      ]);
    },
    [t],
  ) as ToastContextValue;

  const dismiss = useCallback((id: number) => {
    setToasts((previous) => previous.filter((row) => row.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* The live region is this container and not the card, because a region
          has to be in the document before anything is put into it — a card
          that arrives carrying its own `aria-live` is announced unreliably or
          not at all. */}
      <div
        className={cn(
          "pointer-events-none fixed z-[100]",
          "inset-x-0 top-0 flex flex-col items-center",
          "p-4 pt-[calc(env(safe-area-inset-top,0px)+1rem)]",
          "md:inset-x-auto md:inset-y-auto md:right-6 md:bottom-6 md:top-auto",
          "md:items-end md:p-0",
        )}
        aria-live="polite"
      >
        {toasts.map((row) => (
          <SwipeToast
            key={row.id}
            title={row.title}
            description={row.description}
            variant={row.variant}
            actionLabel={row.actionLabel}
            onAction={row.onAction}
            duration={row.duration}
            onClose={() => dismiss(row.id)}
          />
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
