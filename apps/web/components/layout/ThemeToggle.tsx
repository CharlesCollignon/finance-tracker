"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Desktop, Moon, Sun } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type ThemePreference = "light" | "dark" | "system";

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Desktop },
];

const THEME_CHANGE_EVENT = "app-theme-change";

function subscribe(callback: () => void): () => void {
  window.addEventListener(THEME_CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function getSnapshot(): ThemePreference {
  const stored = window.localStorage.getItem("theme");
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return "dark";
}

function getServerSnapshot(): ThemePreference {
  return "dark";
}

function applyPreference(preference: ThemePreference): void {
  const dark =
    preference === "dark" ||
    (preference === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeToggle({ className }: { className?: string }) {
  const preference = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  useEffect(() => {
    if (preference !== "system") {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => applyPreference("system");
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [preference]);

  function handleSelect(next: ThemePreference) {
    window.localStorage.setItem("theme", next);
    applyPreference(next);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn(
        "flex w-fit overflow-hidden rounded-md border border-border bg-card",
        className,
      )}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const selected = preference === value;

        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${label} theme`}
            title={`${label} theme`}
            onClick={() => handleSelect(value)}
            className={cn(
              "flex h-9 w-10 items-center justify-center transition-colors duration-200",
              selected
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon size={16} weight={selected ? "fill" : "regular"} />
          </button>
        );
      })}
    </div>
  );
}
