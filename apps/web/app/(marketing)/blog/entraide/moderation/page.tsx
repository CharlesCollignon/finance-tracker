import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isFlagOn } from "@finance/core/flags";
import { readModerationQueue } from "@finance/data/entraide-moderation";
import { entraideCopyFor } from "@/components/marketing/entraide-copy";
import { ModerationQueue } from "@/components/marketing/entraide/ModerationQueue";
import { getFlags } from "@/lib/flags";
import { getLocale } from "@/lib/locale";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Modération — Entraide — Pluclair",
  robots: { index: false, follow: false },
};

/**
 * The moderator's queue: what members reported and nobody has decided yet.
 * Only for `community.moderate`, read with the service role — it is the one
 * page that sees who wrote what, and their email address. Anyone else gets
 * a 404, as if it were not there.
 */
export default async function ModerationRoutePage() {
  const admin = createAdminClient();
  if (!admin || !isFlagOn(await getFlags(), "community.moderate")) {
    notFound();
  }
  const copy = entraideCopyFor(await getLocale());
  const items = await readModerationQueue(admin);
  return (
    <div className="relative isolate overflow-x-clip px-6 pb-24 pt-32 md:pb-32 md:pt-40">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-4">
          <h1 className="marketing-display text-display-sub">
            {copy.moderation.title}
          </h1>
          <p className="max-w-xl text-marketing-muted">
            {copy.moderation.intro}
          </p>
        </header>
        <ModerationQueue items={items} copy={copy} />
      </div>
    </div>
  );
}
