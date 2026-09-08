import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { ListSkeleton } from "@/components/layout/PageSkeleton";

export default function CategoriesLoading() {
  return (
    <>
      <PageHeader titleKey="pages.categories" />
      <PageContainer>
        <ListSkeleton rows={6} />
      </PageContainer>
    </>
  );
}
