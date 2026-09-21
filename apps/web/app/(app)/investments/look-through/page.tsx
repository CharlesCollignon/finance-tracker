import { redirect } from "next/navigation";

import { formatCurrency } from "@finance/core/constants";
import { describePullAge } from "@finance/core/bank-pull";
import { factsDigest } from "@finance/core/month-facts";
import {
  renderWalletRead,
  targetFromWalletRead,
  walletReadFooting,
} from "@finance/core/wallet-read";
import { buildArbitrage } from "@finance/core/look-through-target";
import { walletReadsRemaining } from "@finance/core/wallet-read-budget";
import { describeModel } from "@finance/core/model-name";

import { getAuthUser } from "@/lib/auth/get-user";
import { getLocale } from "@/lib/locale";
import { LookThroughView } from "@/components/finance/LookThroughView";
import { walletReadConfigured } from "@/lib/wallet-read/client";
import { monthReadModel } from "@/lib/month-read/client";
import { gatherLookThrough } from "@/lib/wallet-read/facts";
import { readWalletReadState } from "@/lib/wallet-read/store";

/**
 * What the wallets are made of.
 *
 * Everything on this page is computed here, on the server, from the positions
 * and whatever has been read about the instruments in them. None of it needs
 * a model or a key — which is the whole design: a read is prose written over
 * figures that already exist, so the page is complete without one and simply
 * has no Review button when no key is configured.
 *
 * The stored read is re-rendered against *current* facts rather than the ones
 * it was written against. That is what keeps a figure on screen from ever
 * contradicting the figure beside it: the prose carries placeholders, not
 * numbers, and the numbers are always today's. The staleness badge is the
 * separate question of whether the words still follow from them.
 */
export default async function LookThroughPage() {
  const user = await getAuthUser();
  if (!user) {
    redirect("/login");
  }

  const locale = await getLocale();

  const [bundle, { stored }] = await Promise.all([
    gatherLookThrough(user.id),
    readWalletReadState(user.id),
  ]);

  const { lookThrough, facts, defaultTarget } = bundle;

  // The read's own target when it proposed one, the app's own otherwise. The
  // surface always has a target to show, including before anything has ever
  // been read and when there is no key at all.
  const readTarget = stored?.read ? targetFromWalletRead(stored.read) : null;
  const target =
    readTarget && readTarget.rows.length > 0 ? readTarget : defaultTarget;

  const rendered = stored?.read
    ? renderWalletRead(
        stored.read,
        facts,
        (amount) => formatCurrency(amount, "EUR", locale),
        // The language the prose was written in, not the reader's current
        // one: a French read re-rendered with English labels reads as broken.
        stored.locale,
      )
    : null;

  // Compared against the digest the read was written with, so a figure the
  // read never leaned on moving is not staleness. Written out rather than
  // inlined: the optional chaining made it read as though a missing row
  // could be stale, which it cannot.
  const storedDigest = stored?.read ? stored.factsDigest : null;
  const stale = storedDigest !== null && storedDigest !== factsDigest(facts);

  const arbitrage = buildArbitrage(
    target,
    bundle.positions.map((position) => ({
      isin: position.isin,
      name: position.name,
      walletId: position.walletId,
      marketValue: position.marketValue,
    })),
    lookThrough.totalValue,
  );

  return (
    <LookThroughView
      lookThrough={lookThrough}
      target={target}
      read={rendered}
      footing={walletReadFooting(facts, locale)}
      readAt={
        stored?.readAt
          ? describePullAge(stored.readAt, new Date().toISOString())
          : null
      }
      stale={stale}
      readsLeft={walletReadsRemaining(stored?.tally ?? null)}
      canReview={walletReadConfigured()}
      // The maker, for the button, from what this deployment is configured
      // with. The exact model that wrote a stored read is a different
      // question and comes off the read itself, below.
      writerBrand={describeModel(monthReadModel()).brand}
      readModel={stored?.read ? stored.model : null}
      queueLength={bundle.queue.length}
      arbitrage={arbitrage}
    />
  );
}
