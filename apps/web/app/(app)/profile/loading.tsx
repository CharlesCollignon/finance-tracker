import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageSkeleton } from "@/components/layout/PageSkeleton";

export default function ProfileLoading() {
  return (
    <>
      <PageHeader title="Profile" />
      <PageContainer>
        <PageSkeleton />
      </PageContainer>
    </>
  );
}
