import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { gatherBearingFacts } from "@/lib/bearing/facts";
import { buildAttention } from "@finance/core/attention";
import { resolveSpine } from "@finance/core/spine";
import { getMonthlyTrend } from "@/lib/queries/finance";
import { getT } from "@/lib/locale";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { EmptyState } from "@/components/layout/EmptyState";
import { AttentionRow } from "@/components/finance/bearing/AttentionRow";
import { BearingCards } from "@/components/finance/bearing/BearingCards";
import { Headline } from "@/components/finance/bearing/Headline";

/**
 * Where the whole of it stands, on one day.
 *
 * The app's landing page, and the only screen that spans every surface: what
 * is on hand, what the month still owes, what is invested, what a year of
 * unchanged habits leads to. Everything on it is a figure some other surface
 * already renders, which is what makes it checkable — a card links to the
 * pages where its figures are explained.
 *
 * Two figures and five cards. It was twelve tiles in a draggable bento whose
 * order a model wrote and a reader could overrule, and the three mechanisms
 * that produced that order — an arrangement, a set of pins, a slot template
 * — were all answers to "which of these matters most?". A list of five, one
 * per fact family, does not ask the question: nothing is ranked because
 * nothing is hidden. The model, the pins and the arrange button are gone
 * with it, and so is the staleness line that existed to say the model's
 * choice had aged.
 *
 * Not streamed into Suspense slots the way Month was. Every figure comes out
 * of one fact pack, so there is no half of the screen that could arrive
 * first; splitting it would mean gathering the pack twice. What a card holds
 * *under* its figures is fetched on the press instead — see `Panel`.
 */
export default async function BearingPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const t = await getT();

  const [facts, trend] = await Promise.all([
    gatherBearingFacts(user.id),
    getMonthlyTrend(user.id),
  ]);

  // Hoisted above the thin branch on purpose. `thin` is not "nobody has
  // done anything" — it is "no position has been taken yet", which is
  // exactly what a reader who has just finished `/welcome` looks like:
  // recurring templates saved, not one row written, so `recurringToApply`
  // is already non-zero and this list already has something in it. It used
  // to be computed below the branch and thrown away for them.
  const attention = buildAttention({
    swallowed: facts.swallowed,
    pendingInbox: facts.pendingInbox,
    recurringToApply: facts.recurringToApply,
    readyToClose: facts.closes.next
      ? {
          monthLabel: facts.closes.next.label,
          isBaseline: facts.closes.next.isBaseline,
        }
      : null,
    proposals: facts.proposals,
  });

  if (facts.thin) {
    return (
      <>
        <PageHeader titleKey="nav.bearing" />
        <PageContainer className="flex flex-col gap-4">
          <EmptyState
            title={t("bearing.title")}
            description={t("bearing.empty")}
          >
            {/* The row, and deliberately not the headline. Two hero-sized
                figures over an empty account are two statements about a
                position nobody has taken yet. The row states nothing about
                the account. It names the one thing worth doing and links to
                where it is done, which is all this reader is short of. */}
            {attention.length > 0 ? (
              <AttentionRow attention={attention} className="w-full" />
            ) : undefined}
          </EmptyState>
          {/* And the walkthrough, because a reader who skipped it entirely
              has no templates, so `attention` above is empty and this
              screen is otherwise one sentence with nothing on it. The
              always-available route back to `/welcome` is `AccountMenu`'s;
              this is the one place worth saying it out loud. */}
          <Link
            href="/welcome"
            className="self-start text-sm font-medium text-primary-ink underline underline-offset-2"
          >
            {t("onboarding.reopen")}
          </Link>
        </PageContainer>
      </>
    );
  }

  // The spine's ladder, a pure function of figures this page already
  // gathered — see `gatherBearingFacts`'s widened return for where `pulse`,
  // `summary` and `closes` come from, and its own doc comment for where
  // `swallowed`, `proposals` and `recurringToApply` come from. The action
  // row's own list is built above, before the thin branch.
  //
  // `everClosed` and `closes` answer two different questions, per
  // `spine.ts`'s own doc comment on `SpineInput`. `everClosed` is "has any
  // close happened, a baseline included" — `history` carries a baseline
  // close (it sets `openingBalance`, which is what makes `unrecordedSoFar`
  // measurable), so its length is the right signal, not `summary.sample`
  // (which only counts *reconciled* closes and stays 0 for the whole month
  // between a baseline close and the first one after it). `closes` is only
  // "is there a streak worth a flame", which a baseline genuinely has none
  // of yet, so it stays null exactly when `sample` is 0.
  const spineState = resolveSpine({
    pulse: facts.pulse,
    everClosed: facts.closes.history.length > 0,
    closes:
      facts.closes.summary.sample > 0
        ? {
            streak: facts.closes.summary.streak,
            bestStreak: facts.closes.summary.bestStreak,
          }
        : null,
    remaining: facts.summary.remaining,
  });

  return (
    <>
      <PageHeader titleKey="nav.bearing" />

      <PageContainer className="flex flex-col gap-6">
        {/* The two figures the screen is opened for, before anything that
            has to be pressed to be read. */}
        <Headline state={spineState} />

        {attention.length > 0 ? <AttentionRow attention={attention} /> : null}

        <BearingCards
          // Unrendered on purpose. The display currency is this browser's
          // localStorage and no server can know it, so every figure on this
          // screen is formatted on the client.
          facts={facts}
          spine={spineState}
          trend={trend.map((point) => point.net)}
        />
      </PageContainer>
    </>
  );
}
