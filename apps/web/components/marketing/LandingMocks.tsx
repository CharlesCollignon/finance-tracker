"use client";

import type { ReactNode } from "react";
import type { LandingPageId } from "@/components/marketing/landing-copy";
import { BearingMock } from "@/components/marketing/mocks/bearing";
import {
  MOBILE_HEIGHT,
  MOBILE_WIDTH,
  MockViewport,
  type Variant,
  WEB_HEIGHT,
  WEB_WIDTH,
} from "@/components/marketing/mocks/frame";
import { MonthCloseMock } from "@/components/marketing/mocks/month-close";
import { MonthReadMock } from "@/components/marketing/mocks/month-read";
import { PlanningMock } from "@/components/marketing/mocks/planning";
import { PropertyMock } from "@/components/marketing/mocks/property";
import { QuestionsMock } from "@/components/marketing/mocks/questions";
import { TaxMock } from "@/components/marketing/mocks/tax";
import { TogetherMock } from "@/components/marketing/mocks/together";
import { RecurringMock } from "@/components/marketing/mocks/recurring";
import { TransactionsMock } from "@/components/marketing/mocks/transactions";
import { WalletsMock } from "@/components/marketing/mocks/wallets";

const PAGE_MOCKS: Record<LandingPageId, (variant: Variant) => ReactNode> = {
  bearing: (variant) => <BearingMock variant={variant} />,
  ledger: (variant) => <TransactionsMock variant={variant} />,
  charges: (variant) => <RecurringMock variant={variant} />,
  plan: (variant) => <PlanningMock variant={variant} />,
  wallets: (variant) => <WalletsMock variant={variant} />,
  "month-close": (variant) => <MonthCloseMock variant={variant} />,
  "month-read": (variant) => <MonthReadMock variant={variant} />,
  property: (variant) => <PropertyMock variant={variant} />,
  questions: (variant) => <QuestionsMock variant={variant} />,
  together: (variant) => <TogetherMock variant={variant} />,
  tax: (variant) => <TaxMock variant={variant} />,
};

/** The right mock for a feature, at its design size, ready to be scaled by
 * whatever frame it is dropped into. */
export function FeatureMock({
  pageId,
  variant = "mobile",
}: {
  pageId: LandingPageId;
  variant?: Variant;
}) {
  return (
    <MockViewport
      width={variant === "web" ? WEB_WIDTH : MOBILE_WIDTH}
      height={variant === "web" ? WEB_HEIGHT : MOBILE_HEIGHT}
    >
      {PAGE_MOCKS[pageId](variant)}
    </MockViewport>
  );
}
