"use client";

import { useT } from "@/lib/locale-context";

export function AuthDivider() {
  const t = useT();

  return (
    <div className="relative flex items-center py-2">
      <div className="flex-1 border-t border-border" />
      <span className="px-3 text-xs font-medium text-muted-foreground">
        {t("auth.or")}
      </span>
      <div className="flex-1 border-t border-border" />
    </div>
  );
}
