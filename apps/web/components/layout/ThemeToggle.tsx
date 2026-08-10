"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Desktop, Moon, Sun } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type ThemePreference = "light" | "dark" | "system";

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] =
  [
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
  return stored === "light" || stored === "dark" ? stored : "system";
}

function getServerSnapshot(): ThemePreference {
  return "system";
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
    if (next === "system") {
      window.localStorage.removeItem("theme");
    } else {
      window.localStorage.setItem("theme", next);
    }
    applyPreference(next);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn(
        "flex w-fit rounded border-2 border-border bg-background",
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
              "flex h-9 w-10 items-center justify-center transition-colors",
              selected
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon size={16} weight={selected ? "fill" : "regular"} />
          </button>
        );
      })}
    </div>
  );
}
