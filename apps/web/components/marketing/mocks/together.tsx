"use client";

import { landingSampleFor } from "@/components/marketing/landing-sample";
import type { Variant } from "@/components/marketing/mocks/frame";
import { LedgerMock } from "@/components/marketing/mocks/transactions";
import { useLocale } from "@/lib/locale-context";

/**
 * The shared space, as a landing mock (`./frame.tsx`): the Journal under
 * « Commun ». The switch sits in the bar (in place of the title on the
 * phone), the nav keeps only what a shared space has — Le point, the
 * Journal, Récurrents — and each row of the joint account carries the
 * initial of whichever of the two added it, as `AuthorBadge` marks it.
 */
export function TogetherMock({ variant = "web" }: { variant?: Variant }) {
  const { together } = landingSampleFor(useLocale());
  return (
    <LedgerMock
      variant={variant}
      space
      rows={together.rows.map((row) => ({
        day: row.day,
        category: row.meta,
        note: row.name,
        icon: row.icon,
        amount: row.amount,
        type: row.type,
        by: row.by,
      }))}
      income={together.income}
      spent={together.spent}
      count={together.entries}
    />
  );
}
