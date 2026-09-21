"use client";

import { useSyncExternalStore } from "react";
import { Eye, EyeSlash } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";

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
  const t = useT();
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

  // The whole of this control's name is its icon, so the accessible name is
  // the only wording it has. An untranslated one is worse than an
  // untranslated visible label: a sighted reader can at least see the eye.
  const label = hidden ? t("common.showAmounts") : t("common.hideAmounts");

  return (
    <button
      type="button"
      aria-pressed={hidden}
      aria-label={label}
      title={label}
      onClick={toggle}
      className={cn(
        // 44px square — the documented touch floor — inside a 52px header
        // band, so the row keeps its height and the icon keeps its size.
        "inline-flex size-11 items-center justify-center rounded-control",
        "border border-border bg-card text-muted-foreground",
        "transition-colors hover:bg-muted hover:text-foreground",
        hidden && "bg-primary/10 text-primary-ink",
        className,
      )}
    >
      {hidden ? (
        <EyeSlash size={ICON.lg} weight="regular" />
      ) : (
        <Eye size={ICON.lg} weight="regular" />
      )}
    </button>
  );
}
