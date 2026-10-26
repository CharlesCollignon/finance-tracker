"use client";

import Link from "next/link";
import { Eye } from "@phosphor-icons/react";
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";

/**
 * Says this is the demo: a sample account, shared by every visitor at
 * once and so read-only (migration 081). One line above the shell, with
 * the way to an account of one's own, on every page the demo shows.
 */
export function DemoBanner() {
  const t = useT();
  return (
    <div
      role="note"
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-border bg-muted/40 px-4 py-2 text-center text-sm"
    >
      <Eye
        size={ICON.md}
        weight="light"
        className="shrink-0 text-muted-foreground"
      />
      <span>{t("demo.banner")}</span>
      <Link href="/signup" className="font-medium underline underline-offset-4">
        {t("demo.createAccount")}
      </Link>
    </div>
  );
}
