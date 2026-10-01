import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-control bg-muted/40", className)}
    />
  );
}

export default function AnalysisLoading() {
  return (
    <>
      <PageHeader titleKey="nav.wallets" />
      <PageContainer>
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex gap-1">
            <Bone className="h-8 w-24 rounded-full" />
            <Bone className="h-8 w-24 rounded-full" />
            <Bone className="h-8 w-28 rounded-full" />
          </div>
          <Bone className="h-8 w-36 rounded-control" />
        </div>
        <div className="flex flex-col gap-4">
          <Bone className="h-4 w-72 max-w-full" />
          {/* Return, split, fees. */}
          <Bone className="h-36 w-full" />
          <Bone className="h-64 w-full" />
          <Bone className="h-32 w-full" />
        </div>
      </PageContainer>
    </>
  );
}
