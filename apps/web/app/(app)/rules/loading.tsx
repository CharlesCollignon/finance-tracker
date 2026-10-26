import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { ListSkeleton } from "@/components/layout/PageSkeleton";

export default function RulesLoading() {
  return (
    <>
      <PageHeader titleKey="rules.title" />
      <PageContainer>
        <ListSkeleton rows={4} />
      </PageContainer>
    </>
  );
}
