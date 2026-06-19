import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { ListSkeleton } from "@/components/layout/PageSkeleton";

export default function InvestmentsLoading() {
  return (
    <>
      <PageHeader title="Wallets" />
      <PageContainer>
        <ListSkeleton rows={4} />
      </PageContainer>
    </>
  );
}
