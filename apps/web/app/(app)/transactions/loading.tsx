import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded bg-muted/40", className)} />
  );
}

export default function TransactionsLoading() {
  return (
    <>
      <PageHeader title="Transactions" />
      <PageContainer>
        <div className="flex flex-col items-center gap-8 md:gap-10">
          <div className="flex w-full flex-col items-center gap-2">
            <Bone className="h-4 w-28" />
            <Bone className="h-12 w-44 md:h-14" />
            <Bone className="h-4 w-52" />
          </div>
          <Bone className="h-64 w-full max-w-2xl" />
          <div className="flex gap-3">
            <Bone className="h-9 w-32" />
            <Bone className="h-9 w-36" />
          </div>
          <div className="w-full space-y-3">
            <Bone className="h-4 w-full" />
            <Bone className="h-10 w-full" />
            <Bone className="h-10 w-full" />
            <Bone className="h-10 w-full" />
            <Bone className="h-10 w-full" />
          </div>
        </div>
      </PageContainer>
    </>
  );
}
