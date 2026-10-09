import { redirect } from "next/navigation";
import { getConversationMessages, listConversations } from "@finance/data/ask";
import { AskView } from "@/components/ask/AskView";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { writerStateFor } from "@/lib/ai/writer";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";

// Two model calls stand behind a question.
export const maxDuration = 60;

/**
 * « Questions » — Ask Pluclair: the person's own money, asked about in
 * words and answered with the app's figures (`@finance/core/ask`). The
 * conversation open is `?c=`; none, and a new one starts.
 */
export default async function AskPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login");
  }

  const db = await createClient();
  const [conversations, writer, params] = await Promise.all([
    listConversations(db, user.id),
    writerStateFor(user.id, db),
    searchParams,
  ]);
  const currentId = conversations.some(({ id }) => id === params.c)
    ? params.c!
    : null;
  const messages = currentId
    ? await getConversationMessages(db, currentId)
    : [];

  return (
    <>
      <PageHeader titleKey="ask.title" />
      <PageContainer>
        <AskView
          conversations={conversations}
          currentId={currentId}
          messages={messages}
          writable={writer.writable}
        />
      </PageContainer>
    </>
  );
}
