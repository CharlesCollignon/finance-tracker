import {
  ArrowsClockwise,
  ChartLineUp,
  ChatCircleDots,
  Compass,
  FileText,
  House,
  Mountains,
  Receipt,
  SealCheck,
  Sparkle,
  UsersThree,
  type Icon,
} from "@phosphor-icons/react";
import type { LandingPageId } from "@/components/marketing/landing-copy";

/** Each feature page's mark: on its menu card, and on its page. */
export const PAGE_ICON: Record<LandingPageId, Icon> = {
  bearing: Compass,
  ledger: Receipt,
  charges: ArrowsClockwise,
  "month-close": SealCheck,
  "month-read": Sparkle,
  plan: Mountains,
  wallets: ChartLineUp,
  property: House,
  questions: ChatCircleDots,
  together: UsersThree,
  tax: FileText,
};
