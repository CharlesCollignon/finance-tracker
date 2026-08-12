import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded bg-muted/40", className)} />
  );
}

export default function BudgetsLoading() {
  return (
    <>
      <PageHeader title="Budgets" />
      <PageContainer>
        <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-8">
          <div className="flex w-full flex-col items-center gap-2">
            <Bone className="h-4 w-28" />
            <Bone className="h-10 w-40" />
          </div>
          <div className="flex w-full flex-col gap-3">
            <Bone className="h-12 w-full" />
            <Bone className="h-12 w-full" />
            <Bone className="h-12 w-full" />
          </div>
        </div>
      </PageContainer>
    </>
  );
}
