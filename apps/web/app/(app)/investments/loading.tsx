import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded bg-muted/40", className)} />
  );
}

export default function InvestmentsLoading() {
  return (
    <>
      <PageHeader title="Wallets" />
      <PageContainer>
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
          <div className="grid w-full max-w-md grid-cols-3 gap-4">
            <Bone className="h-10 w-full" />
            <Bone className="h-10 w-full" />
            <Bone className="h-10 w-full" />
          </div>
          <Bone className="h-56 w-full md:h-64" />
          <div className="w-full space-y-3">
            <Bone className="h-4 w-24" />
            <Bone className="h-24 w-full" />
            <Bone className="h-24 w-full" />
          </div>
        </div>
      </PageContainer>
    </>
  );
}
