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

/** The page's shape while it gathers: the year ahead, two cards, the long view. */
export default function PlanLoading() {
  return (
    <>
      <PageHeader titleKey="nav.plan" />
      <PageContainer>
        <div className="flex flex-col gap-4 md:gap-5">
          <Bone className="h-4 w-72 max-w-full" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
            <div
              className={cn(
                GLASS_CARD,
                "flex flex-col gap-4 rounded-card p-card md:col-span-2 md:p-8",
              )}
            >
              <Bone className="h-4 w-28" />
              <Bone className="h-12 w-48" />
              <Bone className="h-44 w-full" />
            </div>
            {[0, 1].map((index) => (
              <div
                key={index}
                className={cn(
                  GLASS_CARD,
                  "flex flex-col gap-3 rounded-card p-card",
                )}
              >
                <Bone className="h-4 w-32" />
                <Bone className="h-10 w-full" />
                <Bone className="h-10 w-full" />
              </div>
            ))}
            <div
              className={cn(
                GLASS_CARD,
                "flex flex-col gap-3 rounded-card p-card md:col-span-2",
              )}
            >
              <Bone className="h-4 w-40" />
              <Bone className="h-52 w-full" />
            </div>
          </div>
        </div>
      </PageContainer>
    </>
  );
}
