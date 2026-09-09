import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { arrangerConfigured } from "@/lib/bearing/client";
import { gatherBearingFacts } from "@/lib/bearing/facts";
import { readBearingState, readPins } from "@/lib/bearing/store";
import {
  arrangementsRemaining,
  describeArrangementFreshness,
} from "@finance/core/bearing-budget";
import { arrangementFooting } from "@finance/core/bearing-read";
import { mergeArrangement } from "@finance/core/bearing-tiles";
import { formatShortDate } from "@finance/core/constants";
import { getMonthlyTrend } from "@/lib/queries/finance";
import { getLocale, getT } from "@/lib/locale";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { EmptyState } from "@/components/layout/EmptyState";
import { ArrangeButton } from "@/components/finance/bearing/ArrangeButton";
import { BearingGrid } from "@/components/finance/bearing/BearingGrid";
import { MICRO } from "@/lib/type-scale";
import { cn } from "@/lib/utils";

/**
 * Where the whole of it stands, on one day.
 *
 * The app's landing page, and the only screen that spans every surface: what
 * is on hand, what the month still owes, what is invested, what a year of
 * unchanged habits leads to. Everything on it is a figure some other surface
 * already renders, which is what makes it checkable — a tile links to the
 * page where its number is explained.
 *
 * A model chooses which figures lead and writes at most a few words beside
 * one. It never computes anything: it names figures by id and the app
 * substitutes its own formatted values here, which is what keeps the currency
 * toggle and the privacy blur working and what stops a figure nobody computed
 * reaching the screen.
 *
 * Nothing on this page calls a model. The stored arrangement renders for
 * free; only a press spends. And with no arrangement — no key, no migration,
 * or simply nobody has pressed the button — the app's own ordering renders
 * instead, so the surface is never in a degraded state, only in an
 * uncurated one.
 *
 * Not streamed into Suspense slots the way Month is. Every tile comes out of
 * one fact pack, so there is no half of the screen that could arrive first;
 * splitting it would mean gathering the pack twice.
 */
export default async function BearingPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const t = await getT();
  const locale = await getLocale();

  const [facts, { stored, tracked }, pins, trend] = await Promise.all([
    gatherBearingFacts(user.id),
    readBearingState(user.id),
    readPins(user.id),
    getMonthlyTrend(user.id),
  ]);

  if (facts.thin) {
    return (
      <>
        <PageHeader titleKey="nav.bearing" />
        <PageContainer>
          <EmptyState
            title={t("bearing.title")}
            description={t("bearing.empty")}
          />
        </PageContainer>
      </>
    );
  }

  const arrangement = stored?.arrangement ?? null;

  // Captions stay in the language they were written in, so their figures have
  // to be labelled in that language too — otherwise a French caption comes
  // back with an English label spliced into it. Only built when the two
  // actually differ, which is rare and only after somebody switches.
  const captionFacts =
    arrangement && stored && stored.locale !== locale
      ? await gatherBearingFacts(user.id, undefined, stored.locale)
      : facts;

  const order = mergeArrangement(
    arrangement?.tiles.map((tile) => tile.id) ?? [],
    pins,
    facts,
  );

  const freshness =
    arrangement && stored?.facts && stored.arrangedAt
      ? describeArrangementFreshness({
          storedFacts: stored.facts,
          currentFacts: facts,
          footing: arrangementFooting(arrangement),
          arrangedAt: stored.arrangedAt,
          now: new Date().toISOString(),
        })
      : null;

  const hasPins = Object.keys(pins).length > 0;

  return (
    <>
      <PageHeader titleKey="nav.bearing" />

      <PageContainer className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className={cn(MICRO, "text-muted-foreground")}>
            {t("bearing.asOf", { date: formatShortDate(facts.asOf, locale) })}
            {" · "}
            {arrangement ? t("bearing.arrangeHint") : t("bearing.ownOrder")}
          </p>
          <ArrangeButton
            configured={arrangerConfigured()}
            arrangementsLeft={arrangementsRemaining(stored?.tally ?? null)}
            hasPins={hasPins}
          />
        </div>

        <BearingGrid
          order={order}
          // Unrendered on purpose. The display currency is this browser's
          // localStorage and no server can know it, so every figure — inside
          // a caption as much as under a label — is formatted on the client.
          facts={captionFacts}
          arrangement={arrangement}
          captionLocale={stored?.locale ?? locale}
          pins={pins}
          trend={trend.map((point) => point.net)}
          // Dragging writes to `user_preferences`, so it needs nothing from
          // migration 029 — but an arrangement that cannot be stored is a
          // surface with nothing to overrule, and a pin against the app's own
          // fixed ordering would be a preference that never visibly does
          // anything.
          draggable={tracked}
        />

        {/* Only when the figures the choice rests on have actually moved. A
            staleness line that is always on is one nobody reads — which is
            why a month read suppresses this for a running month. Here it is
            worth saying: the choice of tiles is the product, and if what made
            one worth leading with has changed, the ordering is an opinion
            about a position that no longer exists. */}
        {freshness?.standing === "moved" ? (
          <p className={cn(MICRO, "text-muted-foreground")}>
            {t("bearing.moved", {
              count: freshness.moved.length,
              age: freshness.age,
            })}
          </p>
        ) : null}
      </PageContainer>
    </>
  );
}
