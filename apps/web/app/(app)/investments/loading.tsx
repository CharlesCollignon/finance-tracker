import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-muted/40", className)} />;
}

export default function InvestmentsLoading() {
  return (
    <>
      <PageHeader titleKey="nav.wallets" />
      <PageContainer>
        {/* The tab strip is drawn rather than skeletoned: it is already known,
            and rendering a navigation control as bones makes it look
            unavailable. */}
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex gap-1">
            <Bone className="h-8 w-24 rounded-full" />
            <Bone className="h-8 w-28 rounded-full" />
          </div>
          <Bone className="h-8 w-36 rounded-md" />
        </div>
        <div className="flex flex-col items-center gap-8 md:gap-10">
          <div className="flex w-full flex-col items-center gap-2">
            <Bone className="h-4 w-28" />
            <Bone className="h-12 w-44 md:h-14" />
            <Bone className="h-4 w-56" />
          </div>
          <div className="flex gap-4">
            <Bone className="h-4 w-12" />
            <Bone className="h-4 w-12" />
            <Bone className="h-4 w-16" />
          </div>
          <div className="flex w-full max-w-md flex-wrap justify-center gap-2">
            <Bone className="h-10 w-16" />
            <Bone className="h-10 w-16" />
            <Bone className="h-10 w-12" />
            <Bone className="h-10 w-16" />
            <Bone className="h-10 w-20" />
          </div>
          <div className="w-full space-y-3">
            <Bone className="h-4 w-24" />
            {/* The range switch, then rows that now carry their own line. */}
            <Bone className="ml-auto h-9 w-60 rounded-full" />
            <Bone className="h-32 w-full" />
            <Bone className="h-32 w-full" />
          </div>
        </div>
      </PageContainer>
    </>
  );
}
