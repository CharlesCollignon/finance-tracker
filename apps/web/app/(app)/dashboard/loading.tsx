import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded bg-muted/40", className)} />
  );
}

export default function DashboardLoading() {
  return (
    <>
      <PageHeader title="Home" />
      <PageContainer>
        <div className="flex flex-col items-center gap-10 md:gap-12">
          <div className="flex w-full flex-col items-center gap-2">
            <Bone className="h-4 w-36" />
            <Bone className="h-12 w-48 md:h-14" />
            <Bone className="h-4 w-56" />
            <Bone className="h-4 w-28" />
          </div>
          <div className="flex flex-col items-center gap-4">
            <Bone className="h-4 w-32" />
            <div className="flex flex-wrap justify-center gap-6">
              <Bone className="h-28 w-28 rounded-full" />
              <Bone className="h-28 w-28 rounded-full" />
              <Bone className="h-28 w-28 rounded-full" />
            </div>
          </div>
          <div className="flex w-full flex-col items-center gap-3">
            <Bone className="h-4 w-24" />
            <Bone className="h-9 w-40" />
            <Bone className="h-52 w-full max-w-xs rounded-full" />
          </div>
          <div className="flex w-full flex-col items-center gap-3">
            <Bone className="h-4 w-48" />
            <Bone className="h-10 w-24" />
            <Bone className="h-80 w-full" />
          </div>
        </div>
      </PageContainer>
    </>
  );
}
