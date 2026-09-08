"use client";

import type { Key } from "@finance/core/i18n/t";
import { useT } from "@/lib/locale-context";

/**
 * A page's heading, in the reader's language.
 *
 * A client component for one word, which needs a reason. `loading.tsx` is
 * rendered as a Suspense fallback, so it cannot be async and cannot await
 * `getLocale()` — a fallback that suspends is not a fallback. The context
 * `LocaleProvider` puts in the root layout sits above every Suspense
 * boundary, so reading it here works in a skeleton and in a finished page
 * alike, and `PageHeader` stays a server component either way.
 */
export function PageTitle({ titleKey }: { titleKey: Key }) {
  return <>{useT()(titleKey)}</>;
}
