import type { SupabaseClient } from "@supabase/supabase-js";

import {
  INVESTMENT_WALLET_IDS,
  type InvestmentWalletId,
} from "@finance/core/investments";
import type { InvestmentPortfolioSummary } from "@finance/core/investment-positions";
import type { WrapperFees } from "@finance/core/fund-costs";
import {
  buildLookThrough,
  type LookThrough,
  type LookThroughPosition,
} from "@finance/core/look-through";
import {
  buildLookThroughFacts,
  type LookThroughFacts,
} from "@finance/core/look-through-facts";
import {
  buildTargetAllocation,
  defaultAssignments,
  type TargetAllocation,
} from "@finance/core/look-through-target";
import { readingQueue } from "@finance/core/instrument-reading";
import type { InstrumentReading } from "@finance/core/instrument-reading";
import type { Database, WalletPlan } from "@finance/core/types/database";
import { getWalletPortfolio } from "@/lib/queries/wallet-portfolio";
import { getWalletPlans } from "@/lib/queries/investments";
import { getInstrumentReadings } from "@/lib/queries/instrument-readings";

type Client = SupabaseClient<Database>;

/**
 * Everything the look-through surface needs, computed.
 *
 * Assembled here rather than in the page so that the page, the server action
 * and the phone's route all see the same figures — the same arrangement the
 * other two AI features use, and the reason a read verified against these
 * facts can be trusted to have been verified against what was on screen.
 *
 * None of this needs a model or a key. That is the point: the whole surface
 * is arithmetic, and a read is something written over the top of it.
 */

export interface LookThroughBundle {
  portfolio: InvestmentPortfolioSummary;
  lookThrough: LookThrough;
  facts: LookThroughFacts;
  /** The app's own target, used until a read proposes one. */
  defaultTarget: TargetAllocation;
  positions: LookThroughPosition[];
  readings: Map<string, InstrumentReading>;
  /** Wrappers holding something, for the prompt and the page. */
  walletsInUse: InvestmentWalletId[];
  /** ISINs worth reading next, worst first. */
  queue: string[];
  /** False when migration 032 has not run. */
  readingsTracked: boolean;
}

function envelopeFees(plans: WalletPlan[]): WrapperFees {
  const fees: WrapperFees = {};
  for (const plan of plans) {
    if (plan.wrapper_fee !== null && plan.wrapper_fee !== undefined) {
      fees[plan.wallet] = Number(plan.wrapper_fee);
    }
  }
  return fees;
}

export async function gatherLookThrough(
  userId: string,
  client?: Client,
  now: Date = new Date(),
): Promise<LookThroughBundle> {
  const [portfolio, plans, readings] = await Promise.all([
    // History is not needed: nothing here is a time series.
    getWalletPortfolio(userId, { includeHistory: false }),
    getWalletPlans(userId),
    getInstrumentReadings(userId, client),
  ]);

  const positions: LookThroughPosition[] = [];
  for (const column of portfolio.columns) {
    for (const item of column.items) {
      positions.push({
        positionId: item.id,
        name: item.name,
        walletId: column.walletId,
        isin: item.isin,
        marketValue: item.marketValue,
        ongoingCharge: item.ongoingCharge,
      });
    }
  }

  const lookThrough = buildLookThrough({
    positions,
    readings: readings.byIsin,
    envelopeFees: envelopeFees(plans),
    now,
  });

  const defaultTarget = buildTargetAllocation(
    defaultAssignments(
      lookThrough,
      positions.map((position) => ({
        isin: position.isin,
        walletId: position.walletId,
      })),
    ),
  );

  const walletsInUse = INVESTMENT_WALLET_IDS.filter((walletId) =>
    positions.some(
      (position) => position.walletId === walletId && position.marketValue > 0,
    ),
  );

  const held = positions.filter((position) => position.marketValue > 0);

  return {
    portfolio,
    lookThrough,
    facts: buildLookThroughFacts(lookThrough, defaultTarget, walletsInUse),
    defaultTarget,
    positions,
    readings: readings.byIsin,
    walletsInUse,
    queue: readingQueue(
      [
        ...new Set(
          held
            .map((position) => position.isin)
            .filter((isin): isin is string => isin !== null),
        ),
      ],
      readings.byIsin,
      now,
    ),
    readingsTracked: readings.tracked,
  };
}
