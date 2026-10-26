"use client";

import Link from "next/link";
import { Eye } from "@phosphor-icons/react";
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";
import { cn } from "@/lib/utils";

/**
 * Says this is the demo: a sample account, shared by every visitor at
 * once and so read-only (migration 081). A pill under the band, in the
 * page's flow so it covers nothing, with the way to an account of one's
 * own, on every page the demo shows. `AppShell` draws it (`banner`).
 */
export function DemoBanner() {
  const t = useT();
  return (
    <div
      role="note"
      className={cn(
        "mx-auto mb-1 mt-3 flex w-fit max-w-[calc(100%-2rem)] flex-wrap items-center justify-center gap-x-3 gap-y-1",
        "rounded-full border border-border bg-background/95 px-4 py-2 text-center text-sm backdrop-blur-xl",
        "md:mt-0",
      )}
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
