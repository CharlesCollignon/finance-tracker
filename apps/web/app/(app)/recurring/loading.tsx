import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageSkeleton } from "@/components/layout/PageSkeleton";

export default function RecurringLoading() {
  return (
    <>
      <PageHeader title="Recurring" />
      <PageContainer>
        <PageSkeleton />
      </PageContainer>
    </>
  );
}
