import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded bg-muted/40", className)} />
  );
}

export default function RecurringLoading() {
  return (
    <>
      <PageHeader title="Recurring" />
      <PageContainer>
        <div className="flex flex-col items-center gap-8 md:gap-10">
          <div className="flex w-full flex-col items-center gap-2">
            <Bone className="h-4 w-44" />
            <Bone className="h-12 w-40 md:h-14" />
            <Bone className="h-4 w-56" />
          </div>
          <Bone className="h-9 w-40" />
          <div className="flex w-full justify-center gap-4 md:hidden">
            <Bone className="h-4 w-20" />
            <Bone className="h-4 w-20" />
            <Bone className="h-4 w-24" />
          </div>
          <div className="hidden w-full gap-8 md:grid md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-3">
              <Bone className="h-4 w-24" />
              <Bone className="h-14 w-full" />
              <Bone className="h-14 w-full" />
            </div>
            <div className="space-y-3">
              <Bone className="h-4 w-24" />
              <Bone className="h-14 w-full" />
              <Bone className="h-14 w-full" />
            </div>
            <div className="space-y-3">
              <Bone className="h-4 w-28" />
              <Bone className="h-14 w-full" />
            </div>
          </div>
          <div className="w-full space-y-3 md:hidden">
            <Bone className="h-14 w-full" />
            <Bone className="h-14 w-full" />
            <Bone className="h-14 w-full" />
          </div>
        </div>
      </PageContainer>
    </>
  );
}
