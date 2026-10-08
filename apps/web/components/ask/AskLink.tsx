"use client";

import Link from "next/link";
import { ChatCircleText } from "@phosphor-icons/react";
import { ICON } from "@/lib/icon-scale";
import { useT } from "@/lib/locale-context";
import { cn } from "@/lib/utils";

/**
 * The way to « Questions »: under the month read on Le point, and in the
 * sheet Cmd+K opens. A client component of its own so a server page can
 * place it without importing an icon.
 */
export function AskLink({
  className,
  onNavigate,
}: {
  className?: string;
  /** Called on the way out: the sheet closes behind it. */
  onNavigate?: () => void;
}) {
  const t = useT();
  return (
    <Link
      href="/ask"
      onClick={onNavigate}
      className={cn(
        "group inline-flex items-center gap-1.5 self-start rounded-full px-2 py-1 text-sm font-medium text-muted-foreground",
        "transition-colors duration-hover hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      <ChatCircleText
        size={ICON.md}
        className="transition-transform duration-hover group-hover:-rotate-6"
      />
      {t("ask.openFromRead")}
    </Link>
  );
}
