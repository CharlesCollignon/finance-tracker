import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded bg-muted/40", className)} />
  );
}

export default function CalendarLoading() {
  return (
    <>
      <PageHeader title="Calendar" />
      <PageContainer>
        <div className="flex flex-col items-center gap-8 md:gap-10">
          <div className="flex w-full flex-col items-center gap-2">
            <Bone className="h-4 w-28" />
            <Bone className="h-12 w-44 md:h-14" />
            <Bone className="h-4 w-52" />
          </div>
          <div className="w-full space-y-2">
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 7 }).map((_, i) => (
                <Bone key={`h-${i}`} className="h-4 w-full" />
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }).map((_, i) => (
                <Bone key={`c-${i}`} className="h-12 w-full sm:h-16" />
              ))}
            </div>
          </div>
          <div className="w-full space-y-3">
            <Bone className="h-4 w-40" />
            <Bone className="h-4 w-56" />
            <Bone className="h-12 w-full" />
            <Bone className="h-12 w-full" />
          </div>
        </div>
      </PageContainer>
    </>
  );
}
