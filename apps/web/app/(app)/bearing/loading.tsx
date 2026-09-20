import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { GLASS_CARD } from "@/lib/glass";
import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-muted/40", className)} />;
}

/**
 * The shape of the Bearing before its figures arrive.
 *
 * Two stacked figures and five closed cards, which is what `page.tsx`
 * renders: `Headline` states what the accounts hold and what the month has
 * left, and `BearingCards` lists `CARD_ORDER` beneath it with every card
 * shut. It drew the bento until the bento went — ten glass tiles in a
 * hero-and-units rhythm it read out of core, with a pill for the "Rearrange"
 * button — and the Month screen's own retired loading file records why that
 * is the failure worth avoiding here: it kept drawing centred rings for a
 * page that had been rebuilt around something else, which is a worse loading
 * state than none at all.
 *
 * Five cards rather than four or six, and no attention row above them. The
 * card count is fixed — one per fact family, and a family with nothing to say
 * drops out — so five is the ceiling and settling downward by one is barely
 * visible. The row is the opposite: it appears only when something is
 * actually waiting, so drawing it would promise a band most readers do not
 * get, and a skeleton taller than the page it stands in for leaves a
 * scrollbar that vanishes.
 *
 * Heights rather than content. A card's header is a name over a caveat on the
 * left and a label over a figure on the right, and the bones below are those
 * four shapes at the sizes `BearingCards` gives them.
 */
export default function BearingLoading() {
  return (
    <>
      <PageHeader titleKey="nav.bearing" />
      <PageContainer className="flex flex-col gap-6">
        {/* The headline. The first figure is the larger of the two — the
            ladder leads with what the accounts hold when it can read them,
            and the month's remainder follows one step down. */}
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1">
            <Bone className="h-4 w-28" />
            <Bone className="h-10 w-56 md:h-12 md:w-64" />
          </div>
          <div className="flex flex-col gap-1">
            <Bone className="h-4 w-24" />
            <Bone className="h-8 w-44 md:h-10 md:w-52" />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {/* The glow and the spotlight the real card nests inside and
              outside this surface are client components that react to a
              pointer. There is nothing to point at yet, so the skeleton
              borrows only `GLASS_CARD`, the surface between them. */}
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className={cn("rounded-3xl", GLASS_CARD)}>
              <div className="flex items-center gap-4 p-4 md:p-5">
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Bone className="h-4 w-28" />
                  <Bone className="h-3 w-40 max-w-full" />
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <Bone className="h-3 w-20" />
                  <Bone className="h-6 w-24" />
                </div>
                {/* The caret, which is always there whether or not the card
                    has a figure to show. */}
                <Bone className="h-4 w-4 shrink-0 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </PageContainer>
    </>
  );
}
