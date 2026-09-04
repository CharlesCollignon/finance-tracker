import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-muted/40", className)} />;
}

/**
 * The shape of the Month screen before its figures arrive.
 *
 * Deliberately the real layout rather than a generic shimmer: the blocks are
 * left-aligned cards of known height, so matching them means the page does
 * not jump when the numbers land. It said "Home" and drew centred rings until
 * the screen was rebuilt around what the account holds — a skeleton for a
 * layout that no longer existed, which is a worse loading state than none.
 */
export default function DashboardLoading() {
  return (
    <>
      <PageHeader title="Month" />
      <PageContainer className="flex flex-col gap-4">
        {/* The hero: label, the big figure, the sum that explains it. */}
        <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 md:p-6">
          <div className="flex flex-col gap-2">
            <Bone className="h-4 w-32" />
            <Bone className="h-12 w-56 md:h-14" />
            <Bone className="h-4 w-64" />
          </div>
          <Bone className="h-4 w-72 max-w-full" />
          <Bone className="h-1.5 w-full rounded-full" />
          <div className="flex gap-8 border-t border-border pt-4">
            <div className="flex flex-col gap-1.5">
              <Bone className="h-3 w-16" />
              <Bone className="h-5 w-20" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Bone className="h-3 w-16" />
              <Bone className="h-5 w-20" />
            </div>
          </div>
        </div>

        {/* Untracked spending against its target. */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
          <Bone className="h-4 w-44" />
          <div className="flex items-baseline justify-between gap-3">
            <Bone className="h-7 w-24" />
            <Bone className="h-4 w-28" />
          </div>
          <Bone className="h-2 w-full rounded-full" />
          <Bone className="h-4 w-52" />
        </div>

        {/* Still to come, and the last movements on the account. */}
        {[0, 1].map((block) => (
          <div
            key={block}
            className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5"
          >
            <Bone className="h-4 w-36" />
            {[0, 1, 2, 3].map((row) => (
              <div
                key={row}
                className="flex items-center justify-between gap-3"
              >
                <Bone className="h-4 w-40" />
                <Bone className="h-4 w-16" />
              </div>
            ))}
          </div>
        ))}
      </PageContainer>
    </>
  );
}
