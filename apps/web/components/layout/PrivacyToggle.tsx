"use client";

import { useSyncExternalStore } from "react";
import { Eye, EyeSlash } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "privacy-blur";
const CHANGE_EVENT = "app-privacy-change";

function subscribe(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function getSnapshot(): boolean {
  return window.localStorage.getItem(STORAGE_KEY) === "1";
}

function getServerSnapshot(): boolean {
  return false;
}

function applyPrivacy(on: boolean): void {
  document.documentElement.dataset.privacy = on ? "on" : "off";
}

export function PrivacyToggle({ className }: { className?: string }) {
  const hidden = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  function toggle() {
    const next = !hidden;
    window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    applyPrivacy(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return (
    <button
      type="button"
      aria-pressed={hidden}
      aria-label={hidden ? "Show amounts" : "Hide amounts"}
      title={hidden ? "Show amounts" : "Hide amounts"}
      onClick={toggle}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-md",
        "border border-border bg-card text-muted-foreground",
        "transition-colors hover:bg-muted hover:text-foreground",
        hidden && "bg-primary/10 text-primary-ink",
        className,
      )}
    >
      {hidden ? (
        <EyeSlash size={18} weight="regular" />
      ) : (
        <Eye size={18} weight="regular" />
      )}
    </button>
  );
}
