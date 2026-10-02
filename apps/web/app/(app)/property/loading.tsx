import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-control bg-muted/40", className)}
    />
  );
}

export default function PropertyLoading() {
  return (
    <>
      <PageHeader titleKey="nav.property" />
      <PageContainer>
        <div className="flex flex-col gap-8">
          <div className="flex flex-col items-center gap-2">
            <Bone className="h-4 w-40" />
            <Bone className="h-12 w-48 md:h-14" />
            <Bone className="h-4 w-56" />
          </div>
          <Bone className="h-44 w-full rounded-card" />
        </div>
      </PageContainer>
    </>
  );
}
