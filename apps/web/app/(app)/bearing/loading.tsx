import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { GLASS_CARD } from "@/lib/glass";
import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-control bg-muted/40", className)}
    />
  );
}

/**
 * The shape of the Bearing before its figures arrive: the month switcher, the
 * balance card with its two figures over the curve, and the row of cards
 * under it — the shapes `BearingMonthView` draws, at the sizes it draws them.
 *
 * Three cards in the row, the most the month in progress shows. A month with
 * fewer settles upward by a card, which is barely visible; a skeleton taller
 * than the page it stands in for leaves a scrollbar that vanishes.
 */
export default function BearingLoading() {
  return (
    <>
      <PageHeader titleKey="nav.bearing" />
      <PageContainer>
        <div className="flex flex-col gap-4 md:gap-5">
          <Bone className="h-11 w-64 self-center rounded-full" />

          <div
            className={cn(
              GLASS_CARD,
              "flex flex-col gap-6 rounded-card p-card md:p-8",
            )}
          >
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div className="flex flex-col gap-3">
                <Bone className="h-4 w-32" />
                <Bone className="h-14 w-56" />
                <Bone className="h-3 w-44" />
              </div>
              <div className="flex flex-col items-end gap-3">
                <Bone className="h-4 w-36" />
                <Bone className="h-8 w-40" />
                <Bone className="h-6 w-20 rounded-full" />
              </div>
            </div>
            <Bone className="h-[168px] w-full" />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className={cn(
                  GLASS_CARD,
                  "flex flex-col gap-4 rounded-card p-card",
                )}
              >
                <Bone className="h-7 w-28 rounded-full" />
                <Bone className="h-8 w-32" />
                <Bone className="h-20 w-full" />
              </div>
            ))}
          </div>
        </div>
      </PageContainer>
    </>
  );
}
