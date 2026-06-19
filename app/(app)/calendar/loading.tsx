import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { ListSkeleton } from "@/components/layout/PageSkeleton";

export default function CalendarLoading() {
  return (
    <>
      <PageHeader title="Calendar" />
      <PageContainer>
        <ListSkeleton rows={4} />
      </PageContainer>
    </>
  );
}
