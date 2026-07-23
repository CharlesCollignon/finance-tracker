import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { ListSkeleton } from "@/components/layout/PageSkeleton";

export default function TransactionsLoading() {
  return (
    <>
      <PageHeader title="Transactions" />
      <PageContainer>
        <ListSkeleton rows={5} />
      </PageContainer>
    </>
  );
}
