"use client";

import Link from "next/link";
import { Bank } from "@phosphor-icons/react";
import { buttonVariants } from "@/components/ui/Button";
import { ICON } from "@/lib/icon-scale";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/locale-context";

/**
 * Accounts the bank shows that nobody has said anything about yet — a bank
 * just added on open-banking.io, as a rule — said on Le point, where the
 * user looks, and answered on the Bank page, where the question is. Nothing
 * of theirs reaches the ledger or the balance until then, which is why it is
 * said at all.
 */
export function NewAccountsLine({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  const t = useT();
  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-control border border-primary/30 bg-accent px-3 py-2.5",
        className,
      )}
    >
      <Bank
        size={ICON.lg}
        weight="bold"
        aria-hidden
        className="shrink-0 text-primary"
      />
      <p className="min-w-0 flex-1 basis-48 text-sm font-medium">
        {t("bankAccounts.bearingLine", { count })}
      </p>
      <Link href="/bank" className={buttonVariants({ size: "sm" })}>
        {t("bankAccounts.bearingCta", { count })}
      </Link>
    </div>
  );
}
